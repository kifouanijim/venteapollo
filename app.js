let products = [];
let categories = ["Tout voir"];
const state = { category: "Tout voir", search: "", staff: false, staffToken: "", cart: new Map() };
const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const productGrid = document.querySelector("#product-grid");
const categoryList = document.querySelector("#category-list");
const searchInput = document.querySelector("#search-input");
const memberToggle = document.querySelector("#member-toggle");
const cartPanel = document.querySelector("#cart-panel");
const cartBackdrop = document.querySelector("#cart-backdrop");
const toast = document.querySelector("#toast");
let toastTimeout;
let checkoutInProgress = false;

function formatPrice(price) {
  return `${numberFormat.format(price / 100)} €`;
}

function priceFor(product) {
  return state.staff ? product.staffPrice : product.publicPrice;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function loadProducts(staffToken = "") {
  const response = await fetch(`/api/products${staffToken ? "?staff=1" : ""}`, {
    headers: staffToken ? { authorization: `Bearer ${staffToken}` } : {},
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Le catalogue n'a pas pu être chargé.");
  if (!Array.isArray(body.products)) throw new Error("Le catalogue retourné par le serveur est invalide.");
  products = body.products;
  categories = ["Tout voir", ...new Set(products.map((product) => product.category))];
  if (!categories.includes(state.category)) state.category = "Tout voir";
  document.querySelector("#store-error").hidden = true;
  renderCategories();
  renderProducts();
  renderCart();
}

function symbolFor(type) {
  const drawings = {
    glove: '<path d="M27 66c-4-3-6-7-6-12l1-22c0-5 3-8 7-8 3 0 5 3 5 7v8l1-19c0-4 3-7 6-7 4 0 6 3 5 8v18l2-22c0-4 3-6 6-6s6 3 5 8l-2 22 3-15c1-4 4-6 7-5 4 1 5 4 3 8l-5 19c-1 4-3 7-6 10l-5 5 1 8-23 1z" fill="currentColor" stroke="#302521" stroke-width="1.7" stroke-linejoin="round"/><path d="m26 68 26-1 1 11-26 1z" fill="#242321" stroke="#242321" stroke-width="1.5"/><path d="M31 30c4 3 8 3 12 2m-13 5c4 3 8 3 12 2" fill="none" stroke="#fff4eb" stroke-width="1.5" opacity=".55"/>',
    shirt: '<path d="m29 19 10-6c1 5 11 5 13 0l10 6 12 9-8 11-7-5v33H32V34l-7 5-8-11z" fill="currentColor" stroke="#302521" stroke-width="1.7" stroke-linejoin="round"/><path d="M39 16c2 6 11 6 13 0M35 39h22" fill="none" stroke="#fff8ee" stroke-width="1.7" opacity=".58"/><text x="46" y="54" text-anchor="middle" font-size="7" font-family="Arial" font-weight="bold" fill="#f8eee2">A</text>',
    hoodie: '<path d="m30 22 9-7c1 4 11 4 13 0l10 7 12 10-8 11-7-5v33H32V38l-7 5-8-11z" fill="currentColor" stroke="#302521" stroke-width="1.7" stroke-linejoin="round"/><path d="M39 18c-1-12 13-12 13 0m-16 25 5 7h12l4-7m-9 7v9" fill="none" stroke="#eee9df" stroke-width="1.7" opacity=".7"/>',
    shorts: '<path d="M27 21h39l7 49H51l-4-24-5 24H21z" fill="currentColor" stroke="#302521" stroke-width="1.7" stroke-linejoin="round"/><path d="M28 27h37m-18 0v19m-2 0h16" fill="none" stroke="#fff8ee" stroke-width="1.7" opacity=".65"/>',
    helmet: '<path d="M18 51c-2-21 10-38 31-40 22-2 36 13 37 34l-2 8-14 1-7 17H42l-3-16H21z" fill="currentColor" stroke="#302521" stroke-width="2" stroke-linejoin="round"/><path d="M22 49c13 5 27 4 42-2l13 7M37 25c11-7 25-5 34 3" fill="none" stroke="#fff8ee" stroke-width="2" opacity=".58"/>',
    protection: '<path d="M46 13 72 23v22c0 17-11 29-26 38-16-9-27-21-27-38V23z" fill="currentColor" stroke="#302521" stroke-width="2" stroke-linejoin="round"/><path d="M46 26v43m-13-22h26" stroke="#fff8ee" stroke-width="2" opacity=".68"/>',
    wraps: '<path d="M28 27c-7-1-11 4-9 11l9 36c2 8 9 10 15 7l31-17c7-4 8-12 3-18L54 20c-5-6-13-7-18-1l-8 8z" fill="currentColor" stroke="#302521" stroke-width="1.8" stroke-linejoin="round"/><path d="m32 35 10 39m0-47 11 39m1-29 10 35" stroke="#fff8ee" stroke-width="3" opacity=".65"/>',
    socks: '<path d="M33 14h20v38l14 7c8 4 7 15-2 17H29c-8 0-11-9-6-15l10-11z" fill="currentColor" stroke="#302521" stroke-width="1.8" stroke-linejoin="round"/><path d="M33 26h20m-20 7h20" stroke="#fff8ee" stroke-width="2" opacity=".75"/>',
    towel: '<path d="M24 16h47v64H24z" fill="currentColor" stroke="#302521" stroke-width="1.8"/><path d="M31 16v64m33-64v64M35 39h24v13H35z" fill="none" stroke="#fff8ee" stroke-width="1.7" opacity=".7"/><text x="47" y="49" text-anchor="middle" font-size="9" font-family="Arial" font-weight="bold" fill="#fff8ee">A</text>',
    bag: '<path d="M21 38h54l-4 39H25z" fill="currentColor" stroke="#302521" stroke-width="2" stroke-linejoin="round"/><path d="M35 38V28c0-15 26-15 26 0v10M28 47h40m-31 9h22" fill="none" stroke="#302521" stroke-width="2.5" stroke-linecap="round"/><text x="48" y="69" text-anchor="middle" font-size="10" font-family="Arial" font-weight="bold" fill="#fff8ee">A</text>',
    bottle: '<path d="M39 13h16v12l7 7v41c0 4-3 7-7 7H34c-4 0-7-3-7-7V32l7-7V13z" fill="currentColor" stroke="#302521" stroke-width="1.8" stroke-linejoin="round"/><path d="M34 18h26m-31 25h33m-23-7h13" fill="none" stroke="#fff8ee" stroke-width="2" opacity=".7"/><text x="46" y="61" text-anchor="middle" font-size="7" font-family="Arial" font-weight="bold" fill="#fff8ee">A</text>',
    soap: '<path d="M27 31c0-7 5-12 12-12h19c7 0 12 5 12 12v33c0 8-6 13-13 13H40c-8 0-13-5-13-13z" fill="currentColor" stroke="#302521" stroke-width="1.8"/><path d="M33 43h31m-27-9c4-3 8-3 12 0m-9 17c4-3 9-3 14 0" fill="none" stroke="#fff8ee" stroke-width="2" opacity=".7"/>',
    balm: '<path d="M34 25h25l5 10v39H29V35z" fill="currentColor" stroke="#302521" stroke-width="1.8" stroke-linejoin="round"/><path d="M33 17h27v9H33z" fill="#242321" stroke="#242321" stroke-width="1.5"/><path d="M34 46h24m-20 7h16" stroke="#fff8ee" stroke-width="2" opacity=".7"/><text x="46" y="65" text-anchor="middle" font-size="6" font-family="Arial" font-weight="bold" fill="#fff8ee">BAUME</text>',
  };
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${drawings[type] || drawings.protection}</svg>`;
}

function renderCategories() {
  categoryList.innerHTML = categories.map((category) => {
    const active = category === state.category;
    const safeCategory = escapeHtml(category);
    return `<button class="category-button${active ? " active" : ""}" type="button" data-category="${safeCategory}" aria-pressed="${active}">${safeCategory}</button>`;
  }).join("");
}

function filteredProducts() {
  const query = state.search.trim().toLocaleLowerCase("fr");
  return products.filter((product) => {
    const matchesCategory = state.category === "Tout voir" || product.category === state.category;
    const matchesSearch = !query || `${product.name} ${product.category} ${product.badge}`.toLocaleLowerCase("fr").includes(query);
    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  const visibleProducts = filteredProducts();
  document.querySelector("#results-count").textContent = `${visibleProducts.length} article${visibleProducts.length === 1 ? "" : "s"}`;
  document.querySelector("#empty-state").hidden = visibleProducts.length > 0;
  productGrid.hidden = visibleProducts.length === 0;
  productGrid.innerHTML = visibleProducts.map((product, index) => {
    const price = priceFor(product);
    const showPreviousPrice = state.staff && product.publicPrice !== product.staffPrice;
    return `
      <article class="product-card">
        <div class="product-visual visual-${product.tone}">
          <div class="product-symbol">${symbolFor(product.art)}</div>
          <div class="visual-caption"><span>${escapeHtml(product.badge)}</span><span>${String(index + 1).padStart(2, "0")} / ${String(visibleProducts.length).padStart(2, "0")}</span></div>
        </div>
          <p class="product-category">${escapeHtml(product.category)}</p>
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <div class="product-bottom">
          <div class="product-price"><strong>${formatPrice(price)}</strong>${showPreviousPrice ? `<del>${formatPrice(product.publicPrice)}</del>` : ""}</div>
          <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Ajouter ${escapeHtml(product.name)} au panier">+</button>
        </div>
      </article>`;
  }).join("");
}

function renderCart() {
  const items = Array.from(state.cart.entries()).map(([id, quantity]) => ({
    product: products.find((item) => item.id === id),
    quantity,
  })).filter((item) => item.product);
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + priceFor(item.product) * item.quantity, 0);
  document.querySelector("#cart-count").textContent = quantity;
  document.querySelector("#cart-title-count").textContent = `(${quantity})`;
  document.querySelector("#cart-total").textContent = formatPrice(total);
  document.querySelector("#cart-empty").hidden = items.length > 0;
  document.querySelector("#cart-footer").hidden = items.length === 0;
  document.querySelector("#cart-items").innerHTML = items.map(({ product, quantity: itemQuantity }) => `
    <div class="cart-item">
      <div class="cart-item-art" aria-hidden="true">${product.art === "glove" ? "✳" : "A"}</div>
      <div class="cart-item-info">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${formatPrice(priceFor(product))} / article</span>
        <div class="quantity-controls" aria-label="Quantité de ${product.name}">
          <button type="button" data-quantity="${product.id}" data-change="-1" aria-label="Retirer un article">−</button>
          <span>${itemQuantity}</span>
          <button type="button" data-quantity="${product.id}" data-change="1" aria-label="Ajouter un article">+</button>
        </div>
      </div>
      <span class="cart-item-price">${formatPrice(priceFor(product) * itemQuantity)}</span>
    </div>`).join("");
}

function updateCategory(category) {
  if (!categories.includes(category)) return;
  state.category = category;
  renderCategories();
  renderProducts();
}

function changeQuantity(id, change) {
  const nextQuantity = (state.cart.get(id) || 0) + change;
  if (nextQuantity <= 0) state.cart.delete(id);
  else state.cart.set(id, nextQuantity);
  renderCart();
}

function openCart() {
  cartPanel.classList.add("is-open");
  cartPanel.setAttribute("aria-hidden", "false");
  cartBackdrop.hidden = false;
  document.body.classList.add("cart-open");
  document.querySelector("#close-cart").focus();
}

function closeCart() {
  cartPanel.classList.remove("is-open");
  cartPanel.setAttribute("aria-hidden", "true");
  cartBackdrop.hidden = true;
  document.body.classList.remove("cart-open");
  document.querySelector("#open-cart").focus();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (button) updateCategory(button.dataset.category);
});

document.querySelector(".main-nav").addEventListener("click", (event) => {
  const link = event.target.closest("[data-nav-category]");
  if (!link) return;
  updateCategory(link.dataset.navCategory);
  document.querySelector(".main-nav").classList.remove("is-open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
});

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.add);
  if (!product) return;
  changeQuantity(product.id, 1);
  showToast(`${product.name} ajouté au panier`);
});

document.querySelector("#cart-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity]");
  if (button) changeQuantity(button.dataset.quantity, Number(button.dataset.change));
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  renderProducts();
});

memberToggle.addEventListener("change", async () => {
  if (!memberToggle.checked) {
    state.staff = false;
    state.staffToken = "";
    try {
      await loadProducts();
      showToast("Tarifs publics affichés");
    } catch (error) {
      memberToggle.checked = true;
      showToast(error.message);
    }
    return;
  }

  const token = window.prompt("Saisissez la clé d'accès staff fournie par le club.");
  if (!token) {
    memberToggle.checked = false;
    return;
  }

  try {
    state.staffToken = token.trim();
    await loadProducts(state.staffToken);
    state.staff = true;
    renderProducts();
    renderCart();
    showToast("Tarifs staff activés");
  } catch (error) {
    state.staffToken = "";
    state.staff = false;
    memberToggle.checked = false;
    showToast(error.message);
  }
});

document.querySelector("#open-cart").addEventListener("click", openCart);
document.querySelector("#close-cart").addEventListener("click", closeCart);
cartBackdrop.addEventListener("click", closeCart);
document.querySelector("#browse-products").addEventListener("click", () => {
  closeCart();
  document.querySelector("#boutique").scrollIntoView({ behavior: "smooth" });
});
document.querySelector("#checkout-button").addEventListener("click", async (event) => {
  if (checkoutInProgress || state.cart.size === 0) return;
  checkoutInProgress = true;
  const button = event.currentTarget;
  const notice = document.querySelector("#checkout-notice");
  notice.hidden = true;
  button.disabled = true;
  button.firstChild.textContent = "Préparation du paiement… ";

  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(state.staffToken ? { authorization: `Bearer ${state.staffToken}` } : {}),
      },
      body: JSON.stringify({
        items: Array.from(state.cart, ([id, quantity]) => ({ id, quantity })),
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "La commande n'a pas pu être créée.");
    if (typeof body.checkoutUrl !== "string" || !body.checkoutUrl.startsWith("https://checkout.stripe.com/")) {
      throw new Error("Le lien de paiement retourné par Stripe n'est pas valide.");
    }
    window.location.assign(body.checkoutUrl);
  } catch (error) {
    notice.textContent = error.message;
    notice.hidden = false;
  } finally {
    checkoutInProgress = false;
    button.disabled = false;
    button.firstChild.textContent = "Payer avec Stripe ";
  }
});
document.querySelector("#reset-filters").addEventListener("click", () => {
  searchInput.value = "";
  state.search = "";
  updateCategory("Tout voir");
});
document.querySelector("#menu-toggle").addEventListener("click", (event) => {
  const menu = document.querySelector(".main-nav");
  const isOpen = menu.classList.toggle("is-open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cartPanel.classList.contains("is-open")) closeCart();
});

renderCart();
loadProducts().catch((error) => {
  const storeError = document.querySelector("#store-error");
  storeError.textContent = `${error.message} Démarrez le serveur avec npm start, puis rechargez la page.`;
  storeError.hidden = false;
});

async function showCheckoutResult() {
  const currentUrl = new URL(window.location.href);
  const result = currentUrl.searchParams.get("checkout");
  if (!result) return;

  const banner = document.querySelector("#checkout-banner");
  banner.hidden = false;
  if (result === "cancel") {
    banner.textContent = "Paiement annulé. Votre panier est toujours disponible.";
    banner.classList.add("checkout-banner-info");
  } else if (result === "success") {
    const sessionId = currentUrl.searchParams.get("session_id");
    if (!sessionId) {
      banner.textContent = "Votre paiement a été transmis. Si votre commande n'est pas confirmée, contactez le club.";
      banner.classList.add("checkout-banner-info");
    } else {
      try {
        const response = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Le statut du paiement ne peut pas être vérifié.");
        banner.textContent = body.status === "paid"
          ? "Paiement confirmé. Merci pour votre commande ! Le club vous contactera pour le retrait."
          : "Votre paiement est en cours de confirmation. Le club vous contactera dès que la commande sera validée.";
        banner.classList.add(body.status === "paid" ? "checkout-banner-success" : "checkout-banner-info");
      } catch (error) {
        banner.textContent = `Votre retour de paiement a bien été reçu, mais sa confirmation est indisponible : ${error.message}`;
        banner.classList.add("checkout-banner-info");
      }
    }
  }

  currentUrl.searchParams.delete("checkout");
  currentUrl.searchParams.delete("session_id");
  window.history.replaceState({}, "", currentUrl);
}

showCheckoutResult();
