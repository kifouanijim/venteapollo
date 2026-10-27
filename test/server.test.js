"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");

const projectRoot = path.join(__dirname, "..");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "apollo-shop-test-"));
const ordersFile = path.join(temporaryDirectory, "orders.json");
const atomicOrdersFile = path.join(temporaryDirectory, "atomic-orders.json");
const previousOrdersFile = process.env.ORDERS_FILE;
process.env.ORDERS_FILE = atomicOrdersFile;
const { getOrderItems, updateOrders, verifyStripeSignature } = require(path.join(projectRoot, "server.js"));
if (previousOrdersFile === undefined) delete process.env.ORDERS_FILE;
else process.env.ORDERS_FILE = previousOrdersFile;
let serverProcess;
let baseUrl;
let processOutput = "";

before(async () => {
  serverProcess = spawn(process.execPath, [path.join(projectRoot, "server.js")], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: "0",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      ORDERS_FILE: ordersFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.setEncoding("utf8");
  serverProcess.stderr.setEncoding("utf8");
  serverProcess.stdout.on("data", (chunk) => { processOutput += chunk; });
  serverProcess.stderr.on("data", (chunk) => { processOutput += chunk; });

  const deadline = Date.now() + 5000;
  while (!baseUrl && Date.now() < deadline) {
    const match = processOutput.match(/http:\/\/127\.0\.0\.1:(\d+)/);
    if (match) {
      baseUrl = `http://127.0.0.1:${match[1]}`;
      break;
    }
    if (serverProcess.exitCode !== null) throw new Error(`Le serveur n'a pas démarré : ${processOutput}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(baseUrl, `Le serveur n'a pas démarré : ${processOutput}`);
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await new Promise((resolve) => serverProcess.once("exit", resolve));
  }
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("sert les 31 articles avec uniquement les données publiques", async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.products.length, 31);
  assert.equal(body.products[0].publicPrice, 600);
  assert.equal("staffPrice" in body.products[0], false);
});

test("sert le catalogue statique utilisé par la vitrine", async () => {
  const response = await fetch(`${baseUrl}/products.json`);
  const products = await response.json();
  assert.equal(response.status, 200);
  assert.equal(products.length, 31);
  assert.equal(products[0].id, "apollo-silicone");
  assert.equal(products.some((product) => "staffPrice" in product), false);
});

test("refuse un panier invalide et signale le paiement non configuré", async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [{ id: "inconnu", quantity: 1 }] }),
  });
  assert.equal(invalidResponse.status, 400);

  const unconfiguredResponse = await fetch(`${baseUrl}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [{ id: "bandes-35", quantity: 1, unitAmount: 1 }] }),
  });
  assert.equal(unconfiguredResponse.status, 503);
  assert.match((await unconfiguredResponse.json()).error, /pas encore configuré/);
  assert.equal(fs.existsSync(ordersFile), false);
});

test("calcule les montants de commande depuis le catalogue, jamais depuis le navigateur", () => {
  const request = { headers: {} };
  const publicItems = getOrderItems({
    request,
    items: [{ id: "bandes-35", quantity: 2, unitAmount: 1 }],
  });
  assert.equal(publicItems[0].unitAmount, 1500);
  assert.equal(publicItems[0].quantity, 2);
});

test("préserve les commandes lors d'écritures simultanées", async () => {
  await Promise.all([
    updateOrders((orders) => orders.push({ id: "commande-1" })),
    updateOrders((orders) => orders.push({ id: "commande-2" })),
  ]);
  const orders = JSON.parse(fs.readFileSync(atomicOrdersFile, "utf8"));
  assert.deepEqual(orders.map((order) => order.id), ["commande-1", "commande-2"]);
});

test("vérifie la signature Stripe et refuse les notifications sans signature", async () => {
  const secret = "whsec-test-secret";
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ type: "checkout.session.completed" });
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(Buffer.from(body), `t=${timestamp},v1=${digest}`, secret), true);
  assert.equal(verifyStripeSignature(Buffer.from(body), `t=${timestamp},v1=${digest}`, "incorrect"), false);

  const response = await fetch(`${baseUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  assert.equal(response.status, 503);
});
