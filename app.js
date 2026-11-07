let products = [];
let categories = ["Tout voir"];
const PAGE_SIZE = 12;
const state = {
  category: "Tout voir",
  search: "",
  sort: "featured",
  page: 1,
  favoritesOnly: false,
  favorites: new Set(),
  cart: new Map(),
};
const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const productGrid = document.querySelector("#product-grid");
const categoryList = document.querySelector("#category-list");
const searchInput = document.querySelector("#search-input");
const cartPanel = document.querySelector("#cart-panel");
const cartBackdrop = document.querySelector("#cart-backdrop");

function formatPrice(price) {
  return `${numberFormat.format(price / 100)} €`;
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

function loadFavorites() {
  try {
    const storedFavorites = localStorage.getItem("apollo-favorites");
    if (!storedFavorites) return new Set();
    const favoriteIds = JSON.parse(storedFavorites);
    if (!Array.isArray(favoriteIds) || favoriteIds.some((id) => typeof id !== "string")) {
      throw new Error("Le format des favoris enregistrés n’est pas valide.");
    }
    return new Set(favoriteIds.filter((id) => products.some((product) => product.id === id)));
  } catch (error) {
    const storeError = document.querySelector("#store-error");
    storeError.textContent = `Les favoris enregistrés n’ont pas pu être chargés : ${error.message}`;
    storeError.hidden = false;
    return new Set();
  }
}

async function loadProducts() {
  const response = await fetch(new URL("products.json", document.baseURI));
  if (!response.ok) throw new Error("Le catalogue n'a pas pu être chargé.");
  const catalog = await response.json();
  if (!Array.isArray(catalog)) throw new Error("Le fichier products.json ne contient pas un catalogue valide.");
  products = catalog;
  document.querySelector("#store-error").hidden = true;
  state.favorites = loadFavorites();
  categories = ["Tout voir", ...new Set(products.map((product) => product.category))];
  if (!categories.includes(state.category)) state.category = "Tout voir";
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
  const matchingProducts = products.filter((product) => {
    const matchesCategory = state.category === "Tout voir" || product.category === state.category;
    const matchesSearch = !query || `${product.name} ${product.category} ${product.badge}`.toLocaleLowerCase("fr").includes(query);
    const matchesFavorites = !state.favoritesOnly || state.favorites.has(product.id);
    return matchesCategory && matchesSearch && matchesFavorites;
  });

  if (state.sort === "price-ascending") matchingProducts.sort((a, b) => a.publicPrice - b.publicPrice);
  if (state.sort === "price-descending") matchingProducts.sort((a, b) => b.publicPrice - a.publicPrice);
  if (state.sort === "name-ascending") matchingProducts.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return matchingProducts;
}

function renderPagination(pageCount) {
  const pagination = document.querySelector("#catalog-pagination");
  pagination.hidden = pageCount <= 1;
  if (pagination.hidden) {
    pagination.innerHTML = "";
    return;
  }

  const pageButtons = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    const current = page === state.page;
    return `<button class="page-button${current ? " active" : ""}" type="button" data-page="${page}" aria-label="Page ${page}"${current ? ' aria-current="page"' : ""}>${page}</button>`;
  }).join("");
  pagination.innerHTML = `
    <button class="page-button page-step" type="button" data-page="${state.page - 1}" aria-label="Page précédente"${state.page === 1 ? " disabled" : ""}>Précédent</button>
    ${pageButtons}
    <button class="page-button page-step" type="button" data-page="${state.page + 1}" aria-label="Page suivante"${state.page === pageCount ? " disabled" : ""}>Suivant</button>`;
}

function renderProducts() {
  const matchingProducts = filteredProducts();
  const pageCount = Math.ceil(matchingProducts.length / PAGE_SIZE);
  state.page = Math.min(state.page, Math.max(pageCount, 1));
  const firstProductIndex = (state.page - 1) * PAGE_SIZE;
  const visibleProducts = matchingProducts.slice(firstProductIndex, firstProductIndex + PAGE_SIZE);
  document.querySelector("#results-count").textContent = `${matchingProducts.length} article${matchingProducts.length === 1 ? "" : "s"}`;
  document.querySelector("#empty-state").hidden = matchingProducts.length > 0;
  productGrid.hidden = matchingProducts.length === 0;
  document.querySelector("#favorites-count").textContent = state.favorites.size;
  document.querySelector("#favorites-count").hidden = state.favorites.size === 0;
  document.querySelector("#favorites-toggle").setAttribute("aria-pressed", String(state.favoritesOnly));
  document.querySelector("#empty-state-title").textContent = state.favoritesOnly
    ? "Aucun favori pour le moment."
    : "Pas de match pour cette recherche.";
  document.querySelector("#empty-state-message").textContent = state.favoritesOnly
    ? "Touchez le cœur d’un article pour le retrouver ici."
    : "Essayez un autre mot ou choisissez une autre catégorie.";
  document.querySelector("#reset-filters").textContent = state.favoritesOnly
    ? "Voir tous les articles"
    : "Réinitialiser les filtres";
  renderPagination(pageCount);
  productGrid.innerHTML = visibleProducts.map((product, index) => {
    const isFavorite = state.favorites.has(product.id);
    return `
      <article class="product-card">
        <div class="product-visual visual-${product.tone}">
          <div class="product-symbol">${symbolFor(product.art)}</div>
          <div class="visual-caption"><span>${escapeHtml(product.badge)}</span><span>${String(firstProductIndex + index + 1).padStart(2, "0")} / ${String(matchingProducts.length).padStart(2, "0")}</span></div>
          <button class="favorite-product${isFavorite ? " is-favorite" : ""}" type="button" data-favorite="${escapeHtml(product.id)}" aria-label="${isFavorite ? "Retirer" : "Ajouter"} ${escapeHtml(product.name)} ${isFavorite ? "des" : "aux"} favoris" aria-pressed="${isFavorite}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>
          </button>
        </div>
          <p class="product-category">${escapeHtml(product.category)}</p>
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <div class="product-bottom">
          <span class="product-price">${formatPrice(product.publicPrice)}</span>
          <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Ajouter ${escapeHtml(product.name)} au panier de démonstration">+</button>
        </div>
      </article>`;
  }).join("");
}

function renderCart() {
  const items = Array.from(state.cart.entries()).map(([id, quantity]) => ({
    product: products.find((item) => item.id === id),
    quantity,
  })).filter((item) => item.product);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.product.publicPrice * item.quantity, 0);

  document.querySelector("#cart-count").textContent = itemCount;
  document.querySelector("#cart-count").hidden = itemCount === 0;
  document.querySelector("#cart-title-count").textContent = `(${itemCount})`;
  document.querySelector("#cart-total").textContent = formatPrice(total);
  document.querySelector("#cart-empty").hidden = items.length > 0;
  document.querySelector("#cart-footer").hidden = items.length === 0;
  document.querySelector("#cart-items").innerHTML = items.map(({ product, quantity }) => `
    <article class="cart-item">
      <div class="cart-item-art visual-${escapeHtml(product.tone)}" aria-hidden="true">${symbolFor(product.art)}</div>
      <div class="cart-item-info">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${formatPrice(product.publicPrice)} / article</span>
        <div class="quantity-controls" aria-label="Quantité de ${escapeHtml(product.name)}">
          <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="-1" aria-label="Retirer un article">−</button>
          <span>${quantity}</span>
          <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="1" aria-label="Ajouter un article">+</button>
        </div>
      </div>
      <span class="cart-item-price">${formatPrice(product.publicPrice * quantity)}</span>
    </article>`).join("");
}

function changeQuantity(id, change) {
  const quantity = (state.cart.get(id) || 0) + change;
  if (quantity <= 0) state.cart.delete(id);
  else state.cart.set(id, quantity);
  renderCart();
}

function toggleFavorite(id) {
  if (!products.some((product) => product.id === id)) return;
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);

  try {
    localStorage.setItem("apollo-favorites", JSON.stringify([...state.favorites]));
  } catch (error) {
    const storeError = document.querySelector("#store-error");
    storeError.textContent = `Ce favori ne pourra pas être conservé après fermeture du navigateur : ${error.message}`;
    storeError.hidden = false;
  }
  renderProducts();
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

function updateCategory(category) {
  if (!categories.includes(category)) return;
  state.category = category;
  state.page = 1;
  state.favoritesOnly = false;
  renderCategories();
  renderProducts();
}

categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (button) updateCategory(button.dataset.category);
});

document.querySelector("#catalog-pagination").addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  state.page = Number(button.dataset.page);
  renderProducts();
  document.querySelector("#catalog-toolbar").scrollIntoView({ behavior: "smooth", block: "start" });
});

productGrid.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.favorite);
    return;
  }
  const button = event.target.closest("[data-add]");
  if (button) changeQuantity(button.dataset.add, 1);
});

document.querySelector("#favorites-toggle").addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  state.category = "Tout voir";
  state.page = 1;
  searchInput.value = "";
  state.search = "";
  renderCategories();
  renderProducts();
  document.querySelector("#boutique").scrollIntoView({ behavior: "smooth" });
});

const accountDialog = document.querySelector("#account-dialog");
document.querySelector("#open-account").addEventListener("click", () => {
  accountDialog.showModal();
  document.querySelector("#account-email").focus();
});
document.querySelector("#close-account").addEventListener("click", () => accountDialog.close());
accountDialog.addEventListener("close", () => document.querySelector("#open-account").focus());
document.querySelector("#account-form").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#account-message").textContent = "La connexion en ligne n’est pas encore disponible.";
});

document.querySelector("#cart-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity]");
  if (button) changeQuantity(button.dataset.quantity, Number(button.dataset.change));
});

document.querySelector("#open-cart").addEventListener("click", openCart);
document.querySelector("#close-cart").addEventListener("click", closeCart);
cartBackdrop.addEventListener("click", closeCart);
document.querySelector("#browse-products").addEventListener("click", () => {
  closeCart();
  document.querySelector("#boutique").scrollIntoView({ behavior: "smooth" });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cartPanel.classList.contains("is-open")) closeCart();
});

document.querySelector(".main-nav").addEventListener("click", (event) => {
  const link = event.target.closest("[data-nav-category]");
  if (!link) return;
  updateCategory(link.dataset.navCategory);
  document.querySelector(".main-nav").classList.remove("is-open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  state.page = 1;
  renderProducts();
});

document.querySelector("#sort-select").addEventListener("change", (event) => {
  state.sort = event.currentTarget.value;
  state.page = 1;
  renderProducts();
});

document.querySelector("#reset-filters").addEventListener("click", () => {
  searchInput.value = "";
  state.search = "";
  state.favoritesOnly = false;
  updateCategory("Tout voir");
});
document.querySelector("#menu-toggle").addEventListener("click", (event) => {
  const menu = document.querySelector(".main-nav");
  const isOpen = menu.classList.toggle("is-open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
});

loadProducts().catch((error) => {
  const storeError = document.querySelector("#store-error");
  storeError.textContent = `${error.message} Vérifiez que products.json est publié à côté du site, puis rechargez la page.`;
  storeError.hidden = false;
});
