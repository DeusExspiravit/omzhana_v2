const CART_STORAGE_KEY = "omzhana-cart";

const cartDrawerShell = document.querySelector("#cart-drawer-shell");
const cartDrawerBackdrop = document.querySelector("#cart-drawer-backdrop");
const cartDrawerClose = document.querySelector("#cart-drawer-close");
const cartDrawerItems = document.querySelector("#cart-drawer-items");
const cartDrawerEmpty = document.querySelector("#cart-drawer-empty");
const cartDrawerTotal = document.querySelector("#cart-drawer-total");
const cartDrawerView = document.querySelector("#cart-drawer-view");
const cartDrawerCheckout = document.querySelector("#cart-drawer-checkout");
const searchButton = document.querySelector("#search-btn");
const cartButton = document.querySelector("#cart-btn");
const mobileCartTrigger = document.querySelector("#mobile-cart-trigger");
const mobileCartBadge = document.querySelector("#mobile-cart-badge");
const mobileSearchTrigger = document.querySelector("#mobile-search-trigger");
const headerSearchShell = document.querySelector("#header-search-shell");
const headerSearchBackdrop = document.querySelector("#header-search-backdrop");
const headerSearchPanel = document.querySelector("#header-search-panel");
const headerSearchClose = document.querySelector("#header-search-close");
const headerSearchForm = document.querySelector("#header-search-form");
const headerSearchInput = document.querySelector("#header-search-input");
const headerSearchResults = document.querySelector("#header-search-results");
const mobileNavItems = Array.from(document.querySelectorAll(".mobile-bottom-nav-item"));
const currentRoute = document.body.dataset.route || "";
const assistantCatalogElement = document.querySelector("#assistant-catalog-data");

const assistantCatalog = (() => {
    if (!assistantCatalogElement?.textContent) {
        return [];
    }

    try {
        return JSON.parse(assistantCatalogElement.textContent);
    } catch (error) {
        return [];
    }
})();

const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(";").shift();
    }
    return "";
};

const readCart = () => {
    try {
        return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || "[]");
    } catch (error) {
        return [];
    }
};

const writeCart = (items) => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("omzhana-cart-updated"));
};

const parsePrice = (value) => Number(String(value).replace(/[^0-9.]/g, "")) || 0;

const formatPrice = (amount) => `$${amount.toFixed(2)}`;

const itemKeyFor = (item) => `${item.name}::${item.price}`;
const normalizeSearchText = (value) => String(value || "").trim().toLowerCase();
const escapeSearchHtml = (value) =>
    String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const renderCart = () => {
    const items = readCart();
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
    const itemCount = items.reduce((count, item) => count + item.quantity, 0);

    if (cartDrawerItems) {
        cartDrawerItems.innerHTML = items
            .map(
                (item) => `
                    <li class="cart-drawer-item">
                        <img class="cart-drawer-thumb" src="${item.image}" alt="${item.name}">
                        <div class="cart-drawer-item-copy">
                            <p class="cart-drawer-item-name">${item.name}</p>
                            <p class="cart-drawer-item-meta">${item.meta || "Added from store"}</p>
                            <p class="cart-drawer-item-price">${formatPrice(item.price)}</p>
                        </div>
                        <div class="cart-drawer-controls">
                            <button class="cart-drawer-control" data-action="decrement" data-item-key="${itemKeyFor(item)}" type="button" aria-label="Decrease quantity">-</button>
                            <span class="cart-drawer-qty">${item.quantity}</span>
                            <button class="cart-drawer-control cart-drawer-control-remove" data-action="remove" data-item-key="${itemKeyFor(item)}" type="button" aria-label="Remove item">x</button>
                        </div>
                    </li>
                `,
            )
            .join("");
    }

    if (cartDrawerEmpty) {
        cartDrawerEmpty.hidden = items.length > 0;
    }

    if (cartDrawerTotal) {
        cartDrawerTotal.textContent = formatPrice(subtotal);
    }

    if (cartButton) {
        cartButton.textContent = itemCount > 0 ? `Cart (${itemCount})` : "Cart";
    }

    if (mobileCartBadge) {
        mobileCartBadge.hidden = itemCount === 0;
        mobileCartBadge.textContent = String(itemCount);
    }
};

const openCartDrawer = () => {
    if (!cartDrawerShell) {
        return;
    }

    cartDrawerShell.classList.add("is-open");
    cartDrawerShell.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
};

const closeCartDrawer = () => {
    if (!cartDrawerShell) {
        return;
    }

    cartDrawerShell.classList.remove("is-open");
    cartDrawerShell.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
};

const setMobileActiveItem = (itemName) => {
    mobileNavItems.forEach((item) => {
        item.classList.toggle("is-active", item.dataset.navItem === itemName);
    });
};

const resetMobileNavState = () => {
    if (currentRoute === "home" || currentRoute === "shop" || currentRoute === "cart") {
        setMobileActiveItem(currentRoute);
        return;
    }

    setMobileActiveItem("");
};

const getCartItemQuantity = (product) => {
    if (!product?.name) {
        return 0;
    }

    const cart = readCart();
    const existing = cart.find((item) => item.name === product.name && item.price === product.price);
    return Number(existing?.quantity || 0);
};

const setCartItemQuantity = (product, quantity, options = {}) => {
    if (!product?.name) {
        return 0;
    }

    const nextQuantity = Math.max(0, Number(quantity || 0));
    const cart = readCart();
    const index = cart.findIndex((item) => item.name === product.name && item.price === product.price);

    if (index >= 0) {
        if (nextQuantity === 0) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = nextQuantity;
        }
    } else if (nextQuantity > 0 && product.image) {
        cart.push({
            name: product.name,
            price: product.price,
            image: product.image,
            meta: product.meta || "",
            variantId: product.variantId || "",
            handle: product.handle || "",
            quantity: nextQuantity,
        });
    }

    writeCart(cart);
    renderCart();

    if (options.openDrawer) {
        openCartDrawer();
    }

    return nextQuantity;
};

const addToCart = (product) => {
    if (!product?.name || !product?.image) {
        return;
    }

    const quantityToAdd = Math.max(1, Number(product.quantity || 1));
    const nextQuantity = getCartItemQuantity(product) + quantityToAdd;
    setCartItemQuantity(product, nextQuantity, { openDrawer: true });
};

const updateCartItem = (itemKey, action) => {
    const cart = readCart();
    const index = cart.findIndex((item) => itemKeyFor(item) === itemKey);

    if (index === -1) {
        return;
    }

    if (action === "remove") {
        cart.splice(index, 1);
    } else if (action === "decrement") {
        cart[index].quantity -= 1;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
    }

    writeCart(cart);
    renderCart();
};

const extractHomeCardProduct = (button) => {
    const card = button.closest(".product-card");
    if (!card) {
        return null;
    }

    return {
        name: card.querySelector("h3")?.textContent?.trim(),
        price: parsePrice(card.querySelector("p")?.textContent),
        image: card.querySelector("img")?.getAttribute("src"),
        meta: card.dataset.productType || "Featured product",
        variantId: card.dataset.productVariantId || "",
        handle: card.dataset.productHandle || "",
    };
};

document.querySelectorAll(".add-to-cart-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        addToCart(extractHomeCardProduct(button));
    });
});

cartButton?.addEventListener("click", openCartDrawer);

cartDrawerView?.addEventListener("click", () => {
    window.location.href = "/cart/";
});

const beginCheckout = async () => {
    window.location.href = "/cart/";
};

const scoreSearchSuggestion = (product, query) => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return 0;
    }

    const title = normalizeSearchText(product.title);
    const category = normalizeSearchText(product.category);
    const tags = (product.tags || []).map((tag) => normalizeSearchText(tag));
    let score = 0;

    normalizedQuery.split(/\s+/).filter(Boolean).forEach((term) => {
        if (title.includes(term)) {
            score += 5;
        }
        if (category.includes(term)) {
            score += 3;
        }
        if (tags.some((tag) => tag.includes(term))) {
            score += 2;
        }
    });

    return score;
};

const buildSearchSuggestions = (query) => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return assistantCatalog.slice(0, 5).map((product) => ({
            product,
            matchLabel: product.category || "Product",
        }));
    }

    return assistantCatalog
        .map((product) => {
            const score = scoreSearchSuggestion(product, normalizedQuery);
            const matchTag = (product.tags || []).find((tag) =>
                normalizeSearchText(tag).includes(normalizedQuery),
            );
            return {
                product,
                score,
                matchLabel: matchTag || product.category || "Product",
            };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 6);
};

const renderHeaderSearchResults = (query = "") => {
    if (!headerSearchResults) {
        return;
    }

    const suggestions = buildSearchSuggestions(query);

    if (suggestions.length === 0) {
        headerSearchResults.innerHTML = `<p class="header-search-empty">No matching products, tags, or categories found.</p>`;
        return;
    }

    headerSearchResults.innerHTML = suggestions
        .map(
            ({ product, matchLabel }) => `
                <button
                    class="header-search-result-row"
                    type="button"
                    data-search-handle="${escapeSearchHtml(product.handle || "")}"
                    data-search-title="${escapeSearchHtml(product.title || "")}"
                >
                    <span class="header-search-result-copy">
                        <span class="header-search-result-meta">${escapeSearchHtml(product.category || "Product")}</span>
                        <span class="header-search-result-title">${escapeSearchHtml(product.title || "")}</span>
                    </span>
                    <span class="header-search-result-match">${escapeSearchHtml(matchLabel || "Match")}</span>
                </button>
            `,
        )
        .join("");
};

const closeHeaderSearch = () => {
    if (!headerSearchShell) {
        return;
    }

    headerSearchShell.classList.remove("is-open");
    headerSearchShell.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    resetMobileNavState();
};

const openHeaderSearch = () => {
    if (!headerSearchShell) {
        return;
    }

    headerSearchShell.classList.add("is-open");
    headerSearchShell.setAttribute("aria-hidden", "false");
    renderHeaderSearchResults(headerSearchInput?.value || "");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => {
        headerSearchInput?.focus();
        headerSearchInput?.select();
    }, 40);
};

const applyOverlaySearch = ({ query = "", handle = "" } = {}) => {
    const trimmedQuery = String(query || "").trim();

    if (currentRoute === "shop") {
        const searchInput = document.querySelector("#shop-search-input");
        const cards = Array.from(document.querySelectorAll(".product-card"));
        if (searchInput) {
            searchInput.value = trimmedQuery;
            searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        }

        if (handle) {
            const matchingCard = cards.find((card) => card.dataset.productHandle === handle);
            matchingCard?.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        closeHeaderSearch();
        return;
    }

    if (handle) {
        window.location.href = `/shop/?product=${encodeURIComponent(handle)}`;
        return;
    }

    window.location.href = `/shop/?search=${encodeURIComponent(trimmedQuery)}`;
};

const openSearch = () => {
    openHeaderSearch();
};

cartDrawerCheckout?.addEventListener("click", beginCheckout);
searchButton?.addEventListener("click", openSearch);

cartDrawerItems?.addEventListener("click", (event) => {
    const button = event.target.closest(".cart-drawer-control");
    if (!button) {
        return;
    }

    const itemKey = button.dataset.itemKey;
    const action = button.dataset.action;

    if (!itemKey || !action) {
        return;
    }

    updateCartItem(itemKey, action);
});

window.addEventListener("storage", renderCart);
window.addEventListener("omzhana-cart-updated", renderCart);
window.getCartItemQuantity = getCartItemQuantity;
window.setCartItemQuantity = setCartItemQuantity;
window.addToCart = addToCart;

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && cartDrawerShell?.classList.contains("is-open")) {
        closeCartDrawer();
        resetMobileNavState();
    }

    if (event.key === "Escape" && headerSearchShell?.classList.contains("is-open")) {
        closeHeaderSearch();
    }
});

window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;

resetMobileNavState();

mobileCartTrigger?.addEventListener("click", () => {
    setMobileActiveItem("cart");
    openCartDrawer();
});

mobileSearchTrigger?.addEventListener("click", () => {
    setMobileActiveItem("search");
    openSearch();
});

headerSearchBackdrop?.addEventListener("click", closeHeaderSearch);
headerSearchClose?.addEventListener("click", closeHeaderSearch);
headerSearchPanel?.addEventListener("click", (event) => event.stopPropagation());
headerSearchInput?.addEventListener("input", (event) => {
    renderHeaderSearchResults(event.target.value);
});
headerSearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyOverlaySearch({ query: headerSearchInput?.value || "" });
});
headerSearchResults?.addEventListener("click", (event) => {
    const button = event.target.closest(".header-search-result-row");
    if (!button) {
        return;
    }

    const title = button.dataset.searchTitle || "";
    const handle = button.dataset.searchHandle || "";
    if (headerSearchInput) {
        headerSearchInput.value = title;
    }
    applyOverlaySearch({ query: title, handle });
});

cartDrawerBackdrop?.addEventListener("click", () => {
    closeCartDrawer();
    resetMobileNavState();
});

cartDrawerClose?.addEventListener("click", () => {
    closeCartDrawer();
    resetMobileNavState();
});

window.addEventListener(
    "wheel",
    (event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 6) {
            event.preventDefault();
        }
    },
    { passive: false, capture: true },
);

renderCart();
