"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

function loadLocalEnvironment() {
  const envPath = path.join(__dirname, ".env");
  let contents;
  try {
    contents = fs.readFileSync(envPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadLocalEnvironment();

const PORT = Number(process.env.PORT || 3000);
const PRODUCTS_FILE = path.join(__dirname, "products.json");
const ORDERS_FILE = process.env.ORDERS_FILE || path.join(__dirname, "data", "orders.json");
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_ITEMS_PER_ORDER = 100;
const MAX_QUANTITY_PER_ITEM = 20;
const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
const productById = new Map(products.map((product) => [product.id, product]));
let ordersWriteQueue = Promise.resolve();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function staffAccessAllowed(request) {
  const configuredToken = process.env.STAFF_ACCESS_TOKEN || "";
  const match = request.headers.authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match || configuredToken.length < 32) return false;
  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(configuredToken);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

async function readJsonRequest(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new HttpError(413, "La demande dépasse la taille autorisée.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Le contenu de la demande n'est pas un JSON valide.");
  }
}

async function updateOrders(mutator) {
  const operation = ordersWriteQueue.then(async () => {
    let orders;
    try {
      orders = JSON.parse(await fs.promises.readFile(ORDERS_FILE, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      orders = [];
    }

    const result = await mutator(orders);
    await fs.promises.mkdir(path.dirname(ORDERS_FILE), { recursive: true });
    const temporaryPath = `${ORDERS_FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporaryPath, JSON.stringify(orders, null, 2), { mode: 0o600 });
    await fs.promises.rename(temporaryPath, ORDERS_FILE);
    return result;
  });
  ordersWriteQueue = operation.catch(() => {});
  return operation;
}

async function stripeRequest(endpoint, options = {}) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith("sk_")) {
    throw new HttpError(503, "Le paiement en ligne n'est pas encore configuré. Contactez le club.");
  }

  let response;
  try {
    response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
      ...options,
      headers: {
        authorization: `Bearer ${secretKey}`,
        ...(options.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    console.error("Stripe est injoignable :", error.message);
    throw new HttpError(502, "Le prestataire de paiement est momentanément injoignable. Réessayez.");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    console.error("Stripe a retourné une réponse illisible.");
    throw new HttpError(502, "Le prestataire de paiement a retourné une réponse invalide.");
  }

  if (!response.ok) {
    console.error("Erreur Stripe :", result.error?.type || response.status, result.error?.code || "");
    throw new HttpError(502, "Le paiement n'a pas pu être préparé. Réessayez ou contactez le club.");
  }
  return result;
}

function getOrderItems(payload) {
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > MAX_ITEMS_PER_ORDER) {
    throw new HttpError(400, "Le panier est vide ou contient trop d'articles.");
  }

  const seen = new Set();
  return payload.items.map((item) => {
    if (!item || typeof item.id !== "string" || !Number.isInteger(item.quantity)
      || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_ITEM || seen.has(item.id)) {
      throw new HttpError(400, "Un article ou une quantité du panier n'est pas valide.");
    }
    const product = productById.get(item.id);
    if (!product) throw new HttpError(400, "Un article du panier n'existe plus.");
    seen.add(item.id);
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitAmount: product.publicPrice,
    };
  });
}

function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const provided = Buffer.from(signature, "hex");
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  });
}

async function handleWebhook(request, response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    sendJson(response, 503, { error: "Le webhook Stripe n'est pas encore configuré." });
    return;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      sendJson(response, 413, { error: "La notification dépasse la taille autorisée." });
      return;
    }
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);
  if (!verifyStripeSignature(rawBody, request.headers["stripe-signature"], secret)) {
    sendJson(response, 400, { error: "La signature Stripe n'est pas valide." });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    sendJson(response, 400, { error: "La notification Stripe n'est pas un JSON valide." });
    return;
  }

  const session = event.data?.object;
  const orderId = session?.metadata?.orderId;
  const statuses = {
    "checkout.session.completed": session?.payment_status === "paid" ? "paid" : "awaiting_payment",
    "checkout.session.async_payment_succeeded": "paid",
    "checkout.session.async_payment_failed": "payment_failed",
    "checkout.session.expired": "expired",
  };
  const status = statuses[event.type];
  if (status && orderId && session.id) {
    const updated = await updateOrders((orders) => {
      const order = orders.find((entry) => entry.id === orderId && entry.stripeSessionId === session.id);
      if (!order) return false;
      order.status = status;
      order.updatedAt = new Date().toISOString();
      return true;
    });
    if (!updated) {
      console.error("Commande introuvable pour la notification Stripe :", orderId);
      sendJson(response, 500, { error: "La commande correspondante est introuvable." });
      return;
    }
  }

  sendJson(response, 200, { received: true });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, "http://localhost");
  const { pathname } = url;

  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (pathname === "/api/products" && request.method === "GET") {
    sendJson(response, 200, { products });
    return;
  }

  if (pathname === "/api/checkout" && request.method === "POST") {
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      throw new HttpError(415, "Le panier doit être envoyé au format JSON.");
    }
    const payload = await readJsonRequest(request);
    const items = getOrderItems({ ...payload, request });
    if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
      throw new HttpError(503, "Le paiement en ligne n'est pas encore configuré. Contactez le club.");
    }
    const configuredBaseUrl = process.env.APP_BASE_URL;
    if (process.env.NODE_ENV === "production" && !configuredBaseUrl) {
      throw new HttpError(500, "L'adresse publique de la boutique doit être configurée.");
    }
    const requestOrigin = `http://${request.headers.host || "localhost"}`;
    const baseUrl = configuredBaseUrl || requestOrigin;
    let checkoutOrigin;
    try {
      checkoutOrigin = new URL(baseUrl);
    } catch {
      throw new HttpError(500, "L'adresse de retour du paiement n'est pas correctement configurée.");
    }
    if (!["http:", "https:"].includes(checkoutOrigin.protocol)
      || checkoutOrigin.username || checkoutOrigin.password
      || checkoutOrigin.pathname !== "/" || checkoutOrigin.search || checkoutOrigin.hash
      || (process.env.NODE_ENV === "production" && checkoutOrigin.protocol !== "https:")) {
      throw new HttpError(500, "L'adresse de retour du paiement doit être une URL HTTP(S) publique valide.");
    }
    if (request.headers.origin) {
      let origin;
      try {
        origin = new URL(request.headers.origin).origin;
      } catch {
        throw new HttpError(403, "La demande de paiement doit provenir de la boutique.");
      }
      if (origin !== checkoutOrigin.origin) {
        throw new HttpError(403, "La demande de paiement doit provenir de la boutique.");
      }
    }
    const orderId = crypto.randomUUID();
    const totalAmount = items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
    const order = {
      id: orderId,
      status: "creating_checkout",
      currency: "eur",
      fulfillment: "free_club_pickup",
      items,
      totalAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await updateOrders((orders) => orders.push(order));

    const form = new URLSearchParams({
      mode: "payment",
      success_url: `${checkoutOrigin.origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${checkoutOrigin.origin}/?checkout=cancel`,
      billing_address_collection: "required",
      "metadata[orderId]": orderId,
      "client_reference_id": orderId,
      "custom_text[submit][message]": "Retrait gratuit au club. Les modalités de retrait vous seront communiquées après paiement.",
    });
    items.forEach((item, index) => {
      form.set(`line_items[${index}][price_data][currency]`, "eur");
      form.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
      form.set(`line_items[${index}][price_data][product_data][name]`, item.name);
      form.set(`line_items[${index}][price_data][product_data][metadata][productId]`, item.productId);
      form.set(`line_items[${index}][quantity]`, String(item.quantity));
    });

    try {
      const session = await stripeRequest("checkout/sessions", { method: "POST", body: form });
      await updateOrders((orders) => {
        const storedOrder = orders.find((entry) => entry.id === orderId);
        if (!storedOrder) throw new Error("La commande a disparu pendant la création du paiement.");
        storedOrder.status = "awaiting_payment";
        storedOrder.stripeSessionId = session.id;
        storedOrder.updatedAt = new Date().toISOString();
      });
      sendJson(response, 201, { checkoutUrl: session.url });
    } catch (error) {
      await updateOrders((orders) => {
        const storedOrder = orders.find((entry) => entry.id === orderId);
        if (storedOrder) {
          storedOrder.status = "checkout_failed";
          storedOrder.updatedAt = new Date().toISOString();
        }
      });
      throw error;
    }
    return;
  }

  if (pathname === "/api/checkout/status" && request.method === "GET") {
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      throw new HttpError(400, "La référence de paiement n'est pas valide.");
    }
    const session = await stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}`);
    const orderId = session.metadata?.orderId;
    if (!orderId) throw new HttpError(404, "La commande correspondante est introuvable.");
    const status = session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : "awaiting_payment";
    const updated = await updateOrders((orders) => {
      const order = orders.find((entry) => entry.id === orderId && entry.stripeSessionId === session.id);
      if (!order) return false;
      order.status = status;
      order.updatedAt = new Date().toISOString();
      return true;
    });
    if (!updated) throw new HttpError(404, "La commande correspondante est introuvable.");
    sendJson(response, 200, { status });
    return;
  }

  if (pathname === "/api/stripe/webhook" && request.method === "POST") {
    await handleWebhook(request, response);
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Cette route API n'existe pas." });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Cette méthode n'est pas autorisée." });
    return;
  }

  const requestedFile = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const allowedFiles = new Map([
    ["index.html", ["text/html; charset=utf-8"]],
    ["styles.css", ["text/css; charset=utf-8"]],
    ["app.js", ["text/javascript; charset=utf-8"]],
    ["products.json", ["application/json; charset=utf-8"]],
  ]);
  const file = allowedFiles.get(requestedFile);
  if (!file) {
    sendJson(response, 404, { error: "Cette page n'existe pas." });
    return;
  }

  const filePath = path.join(__dirname, requestedFile);
  const contents = await fs.promises.readFile(filePath);
  response.writeHead(200, {
    "content-type": file[0],
    "cache-control": "no-cache",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
  });
  response.end(request.method === "HEAD" ? undefined : contents);
}

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error("PORT doit être un numéro de port valide.");
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    if (!(error instanceof HttpError)) console.error("Erreur interne :", error);
    sendJson(response, error instanceof HttpError ? error.status : 500, {
      error: error instanceof HttpError ? error.message : "Une erreur interne est survenue. Réessayez ou contactez le club.",
    });
  });
});

if (require.main === module) {
  const host = process.env.HOST || "127.0.0.1";
  server.listen(PORT, host, () => {
    const address = server.address();
    console.log(`Boutique Apollo disponible sur http://${host}:${address.port}`);
  });
}

module.exports = { server, products, getOrderItems, updateOrders, verifyStripeSignature };
