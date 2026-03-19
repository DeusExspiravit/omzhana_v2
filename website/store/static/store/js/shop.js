const detailShell = document.querySelector("#product-detail-shell");
const detailPanel = document.querySelector("#product-detail-panel");
const detailBackdrop = document.querySelector("#product-detail-backdrop");
const detailClose = document.querySelector("#product-detail-close");
const detailGallery = document.querySelector("#product-detail-gallery");
const detailTitle = document.querySelector("#product-detail-title");
const detailTime = document.querySelector("#product-detail-time");
const detailDescription = document.querySelector("#product-detail-description");
const detailPrice = document.querySelector("#product-detail-price");
const detailTags = document.querySelector("#product-detail-tags");
const detailQuantityControl = document.querySelector("#product-detail-quantity");
const detailQuantityDecrement = document.querySelector("#product-detail-quantity-decrement");
const detailQuantityIncrement = document.querySelector("#product-detail-quantity-increment");
const detailQuantityValue = document.querySelector("#product-detail-quantity-value");
const detailCartButton = document.querySelector("#product-detail-cart");
const productCards = document.querySelectorAll(".product-card");
const imageTrack = document.querySelector("#image-track");
const trackImages = imageTrack ? Array.from(imageTrack.getElementsByClassName("image")) : [];
const categoryButtons = document.querySelectorAll(".category-btn");
const menuOverlayShell = document.querySelector("#menu-overlay-shell");
const menuOverlayBackdrop = document.querySelector("#menu-overlay-backdrop");
const menuOverlayPanel = document.querySelector("#menu-overlay-panel");
const menuOverlayClose = document.querySelector("#menu-overlay-close");
const menuOverlayPreviewImage = document.querySelector("#menu-overlay-preview-image");
const menuOverlayTitle = document.querySelector("#menu-overlay-title");
const menuOverlayDescription = document.querySelector("#menu-overlay-description");
const menuOverlaySearchInput = document.querySelector("#menu-overlay-search-input");
const menuOverlaySearchButton = document.querySelector("#menu-overlay-search-btn");
const menuOverlaySortSelect = document.querySelector("#menu-overlay-sort-select");
const menuOverlayGrid = document.querySelector("#menu-overlay-grid");
const categoriesDataElement = document.querySelector("#shop-categories-data");
const shopSearchInput = document.querySelector("#shop-search-input");
const shopSearchButton = document.querySelector("#shop-search-btn");
const shopSortSelect = document.querySelector("#shop-sort-select");
const shopAvailabilitySelect = document.querySelector("#shop-availability-select");
const shopCategoryFilters = document.querySelector("#shop-category-filters");
const shopMobileSearchInput = document.querySelector("#shop-mobile-search-input");
const shopMobileSearchButton = document.querySelector("#shop-mobile-search-btn");
const shopMobileSortSelect = document.querySelector("#shop-mobile-sort-select");
const shopMobileAvailabilitySelect = document.querySelector("#shop-mobile-availability-select");
const shopMobileCategoryFilters = document.querySelector("#shop-mobile-category-filters");
const shopResultsCount = document.querySelector("#shop-results-count");
const shopResetButton = document.querySelector("#shop-reset-btn");
const shopProductsSection = document.querySelector("#shop-products-section");
const shopMobileControlsTrigger = document.querySelector("#shop-mobile-controls-trigger");
const shopMobileControlsClose = document.querySelector("#shop-controls-mobile-close");
const shopControlsBackdrop = document.querySelector("#shop-controls-backdrop");

let lastFocusedCard = null;
let activeProduct = null;
let lastFocusedCategory = null;
let trackPercentage = Number(imageTrack?.dataset.percentage || "0");
let trackRafId = null;
let dragStartX = 0;
let dragStartPercentage = 0;
let isDraggingTrack = false;
let trackMoved = false;
let pendingTrackButton = null;
let activeShopCategory = "all";
let activeDetailQuantity = 1;

const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(Number(value || 0));

const syncDetailQuantity = () => {
    if (!detailQuantityValue) {
        return;
    }

    detailQuantityValue.textContent = String(activeDetailQuantity);

    if (detailQuantityControl) {
        detailQuantityControl.hidden = activeDetailQuantity <= 0;
    }

    if (detailCartButton) {
        detailCartButton.hidden = activeDetailQuantity > 0;
    }

    if (detailPrice && activeProduct) {
        detailPrice.textContent = formatCurrency(activeProduct.price * Math.max(activeDetailQuantity, 1));
    }
};

const refreshDetailQuantityFromCart = () => {
    activeDetailQuantity = activeProduct ? Number(window.getCartItemQuantity?.(activeProduct) || 0) : 0;
    syncDetailQuantity();
};

const applyMenuOverlaySearch = () => {
    if (!menuOverlayGrid) {
        return;
    }

    const searchTerm = normalizeText(menuOverlaySearchInput?.value);
    const sortValue = menuOverlaySortSelect?.value || "featured";
    const cards = Array.from(menuOverlayGrid.querySelectorAll(".menu-overlay-card"));
    const visibleCards = [];

    cards.forEach((card) => {
        const name = normalizeText(card.dataset.productName);
        const description = normalizeText(card.dataset.productDescription);
        const tags = normalizeText(card.dataset.productTags).split("|").filter(Boolean);
        const matches =
            !searchTerm ||
            name.includes(searchTerm) ||
            description.includes(searchTerm) ||
            tags.some((tag) => tag.includes(searchTerm));

        card.hidden = !matches;

        if (matches) {
            visibleCards.push(card);
        }
    });

    const sortedCards = sortCards(visibleCards, sortValue);
    sortedCards.forEach((card) => menuOverlayGrid.appendChild(card));
};

const updateTrackFade = () => {
    if (!imageTrack) {
        return;
    }

    const section = imageTrack.closest(".product-category");
    if (!section) {
        return;
    }

    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const fadeProgress = clamp(scrollTop / 280, 0, 1);
    const opacity = 1 - fadeProgress;
    const blur = fadeProgress * 8;
    imageTrack.style.setProperty("--track-opacity", String(opacity));
    imageTrack.style.setProperty("--track-blur", `${blur}px`);
    document.documentElement.style.setProperty("--menu-section-opacity", String(opacity));
};

const getProductData = (card) => ({
    name: card.dataset.productName || "",
    price:
        Number(String(card.dataset.productPriceAmount || card.dataset.productPrice || "").replace(/[^0-9.]/g, "")) ||
        0,
    image: card.querySelector("img")?.getAttribute("src") || "",
    meta: card.dataset.productType || "Store item",
    variantId: card.dataset.productVariantId || "",
    handle: card.dataset.productHandle || "",
});

const openDetailFromPayload = (payload, originCard) => {
    if (!detailShell || !detailGallery || !detailTags) {
        return;
    }

    const images = payload.images || [];
    const tags = payload.tags || [];
    activeProduct = {
        name: payload.name || "",
        price: payload.numericPrice || 0,
        image: payload.image || "",
        meta: payload.meta || "",
        variantId: payload.variantId || "",
        handle: payload.handle || "",
    };

    detailTitle.textContent = payload.name || "";
    detailTime.textContent = payload.meta || "";
    detailDescription.textContent = payload.description || "";
    refreshDetailQuantityFromCart();

    detailGallery.innerHTML = images
        .map(
            (src, index) => `
                <div class="product-detail-gallery-item">
                    <img src="${src}" alt="${payload.name || "Product"} image ${index + 1}">
                </div>
            `,
        )
        .join("");

    detailTags.innerHTML = tags.map((tag) => `<li>${tag}</li>`).join("");

    detailShell.classList.add("is-open");
    detailShell.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    detailPanel?.querySelector(".product-detail-scroll")?.scrollTo({ top: 0 });
    requestAnimationFrame(() => {
        if (originCard) {
            animatePanelFromCard(originCard);
        }
    });
};

const categoriesData = (() => {
    if (!categoriesDataElement?.textContent) {
        return [];
    }

    try {
        return JSON.parse(categoriesDataElement.textContent);
    } catch (error) {
        return [];
    }
})();

const filterableCards = Array.from(productCards);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeText = (value) => String(value || "").trim().toLowerCase();
const isMobileShopViewport = () => window.matchMedia("(max-width: 900px)").matches;

const syncMobileShopControls = () => {
    if (shopMobileSearchInput && shopSearchInput) {
        shopMobileSearchInput.value = shopSearchInput.value;
    }

    if (shopMobileSortSelect && shopSortSelect) {
        shopMobileSortSelect.value = shopSortSelect.value;
    }

    if (shopMobileAvailabilitySelect && shopAvailabilitySelect) {
        shopMobileAvailabilitySelect.value = shopAvailabilitySelect.value;
    }

    if (shopMobileCategoryFilters) {
        shopMobileCategoryFilters.querySelectorAll(".shop-filter-chip").forEach((chip) => {
            chip.classList.toggle("is-active", (chip.dataset.filterCategory || "all") === activeShopCategory);
        });
    }
};

const closeMobileShopControls = () => {
    if (!shopProductsSection) {
        return;
    }

    shopProductsSection.classList.remove("is-mobile-controls-open");
    if (shopMobileControlsTrigger) {
        shopMobileControlsTrigger.setAttribute("aria-expanded", "false");
    }
    if (shopControlsBackdrop) {
        shopControlsBackdrop.hidden = true;
    }
    document.body.style.overflow = "";
};

const openMobileShopControls = () => {
    if (!shopProductsSection || !isMobileShopViewport()) {
        return;
    }

    shopProductsSection.classList.add("is-mobile-controls-open");
    if (shopMobileControlsTrigger) {
        shopMobileControlsTrigger.setAttribute("aria-expanded", "true");
    }
    if (shopControlsBackdrop) {
        shopControlsBackdrop.hidden = false;
    }
    document.body.style.overflow = "hidden";
};

window.openMobileShopControls = openMobileShopControls;
window.closeMobileShopControls = closeMobileShopControls;

const renderTrackMovement = () => {
    if (!imageTrack) {
        return;
    }

    const clamped = clamp(trackPercentage, -100, 0);
    imageTrack.style.transform = `translate(${clamped}%, -50%)`;
    trackImages.forEach((image) => {
        image.style.objectPosition = `${100 + clamped}% center`;
    });
    imageTrack.dataset.percentage = String(clamped);
    imageTrack.dataset.prevPercentage = String(clamped);
    trackPercentage = clamped;
    trackRafId = null;
};

const applyTrackMovement = (nextPercentage) => {
    trackPercentage = clamp(nextPercentage, -100, 0);
    if (trackRafId !== null) {
        return;
    }
    trackRafId = window.requestAnimationFrame(renderTrackMovement);
};

const sortCards = (cards, sortValue) => {
    const sorted = [...cards];

    sorted.sort((left, right) => {
        const leftName = normalizeText(left.dataset.productName);
        const rightName = normalizeText(right.dataset.productName);
        const leftPrice = Number(left.dataset.productPriceAmount || 0);
        const rightPrice = Number(right.dataset.productPriceAmount || 0);
        const leftIndex = Number(left.dataset.productIndex || 0);
        const rightIndex = Number(right.dataset.productIndex || 0);

        switch (sortValue) {
            case "price-asc":
                return leftPrice - rightPrice;
            case "price-desc":
                return rightPrice - leftPrice;
            case "name-asc":
                return leftName.localeCompare(rightName);
            case "name-desc":
                return rightName.localeCompare(leftName);
            default:
                return leftIndex - rightIndex;
        }
    });

    return sorted;
};

const getMenuOverlayProductData = (card) => ({
    name: card.dataset.productName || "",
    price:
        Number(String(card.dataset.productPriceAmount || card.dataset.productPriceDisplay || "").replace(/[^0-9.]/g, "")) ||
        0,
    image: card.querySelector("img")?.getAttribute("src") || "",
    meta: card.dataset.productMeta || "Menu overlay",
    variantId: card.dataset.productVariantId || "",
});

const syncMenuOverlayCardQuantity = (card) => {
    const product = getMenuOverlayProductData(card);
    const quantity = Number(window.getCartItemQuantity?.(product) || 0);
    const addButton = card.querySelector(".product-cart-adding");
    const quantityControl = card.querySelector(".product-card-quantity");
    const quantityValue = card.querySelector(".product-card-quantity-value");

    if (quantityValue) {
        quantityValue.textContent = String(quantity);
    }

    if (quantityControl) {
        quantityControl.hidden = quantity <= 0;
    }

    if (addButton) {
        addButton.hidden = quantity > 0;
    }
};

const renderSharedProductCardMarkup = ({
    className = "product-card",
    name = "",
    priceDisplay = "",
    priceAmount = 0,
    description = "",
    image = "",
    images = [],
    tags = [],
    variantId = "",
    meta = "",
}) => `
    <article
        class="${className}"
        tabindex="0"
        data-product-name="${name}"
        data-product-price-display="${priceDisplay}"
        data-product-price-amount="${priceAmount}"
        data-product-description="${description}"
        data-product-image="${image}"
        data-product-images="${images.map((item) => item.url).join("|")}"
        data-product-tags="${tags.join("|")}"
        data-product-variant-id="${variantId}"
        data-product-meta="${meta}"
    >
        <img src="${image}" alt="${name}">
        <div class="product-card-lower">
            <div class="product-card-copy">
                <p class="product-name">${name}</p>
                <p class="price-listing">${priceDisplay}</p>
                <ul class="product-categories">
                    ${tags.slice(0, 2).map((tag) => `<li>${tag}</li>`).join("") || `<li>${meta}</li>`}
                </ul>
            </div>
            <div class="product-actions">
                <div class="product-card-quantity" hidden>
                    <button class="product-card-quantity-btn" type="button" data-action="decrement" aria-label="Decrease quantity">-</button>
                    <span class="product-card-quantity-value">1</span>
                    <button class="product-card-quantity-btn" type="button" data-action="increment" aria-label="Increase quantity">+</button>
                </div>
                <button class="product-cart-adding" type="button">Add to Cart</button>
            </div>
        </div>
    </article>
`;

const updateResultsCount = (count) => {
    if (!shopResultsCount) {
        return;
    }

    shopResultsCount.textContent = `${count} product${count === 1 ? "" : "s"} shown`;
};

const applyShopFilters = () => {
    const searchTerm = normalizeText(shopSearchInput?.value);
    const sortValue = shopSortSelect?.value || "featured";
    const availability = shopAvailabilitySelect?.value || "all";

    const visibleCards = filterableCards.filter((card) => {
        const name = normalizeText(card.dataset.productName);
        const description = normalizeText(card.dataset.productDescription);
        const category = normalizeText(card.dataset.productCategory);
        const tags = normalizeText(card.dataset.productTags).split("|").filter(Boolean);
        const available = card.dataset.productAvailable === "true";

        const matchesSearch =
            !searchTerm ||
            name.includes(searchTerm) ||
            description.includes(searchTerm) ||
            category.includes(searchTerm) ||
            tags.some((tag) => tag.includes(searchTerm));

        const matchesCategory =
            activeShopCategory === "all" || category === activeShopCategory;

        const matchesAvailability =
            availability === "all" || (availability === "available" && available);

        const isVisible = matchesSearch && matchesCategory && matchesAvailability;
        card.classList.toggle("is-hidden", !isVisible);
        return isVisible;
    });

    const sortedCards = sortCards(visibleCards, sortValue);
    const parent = filterableCards[0]?.parentElement;
    if (parent) {
        sortedCards.forEach((card) => parent.appendChild(card));
    }

    updateResultsCount(visibleCards.length);
    syncMobileShopControls();
};

const animatePanelFromCard = (card) => {
    if (!detailPanel) {
        return;
    }

    const cardRect = card.getBoundingClientRect();
    const panelRect = detailPanel.getBoundingClientRect();

    const deltaX = cardRect.left - panelRect.left;
    const deltaY = cardRect.top - panelRect.top;
    const scaleX = cardRect.width / panelRect.width;
    const scaleY = cardRect.height / panelRect.height;

    detailPanel.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
    detailPanel.style.opacity = "0.18";

    requestAnimationFrame(() => {
        detailPanel.style.transform = "translate(0, 0) scale(1, 1)";
        detailPanel.style.opacity = "1";
    });
};

const animatePanelFromCategory = (button) => {
    if (!menuOverlayPanel) {
        return;
    }

    const cardRect = button.getBoundingClientRect();
    const panelRect = menuOverlayPanel.getBoundingClientRect();

    const deltaX = cardRect.left - panelRect.left;
    const deltaY = cardRect.top - panelRect.top;
    const scaleX = cardRect.width / panelRect.width;
    const scaleY = cardRect.height / panelRect.height;

    menuOverlayPanel.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
    menuOverlayPanel.style.opacity = "0.18";

    requestAnimationFrame(() => {
        menuOverlayPanel.style.transform = "translate(0, 0) scale(1, 1)";
        menuOverlayPanel.style.opacity = "1";
    });
};

const renderMenuOverlay = (category) => {
    if (!category || !menuOverlayTitle || !menuOverlayDescription || !menuOverlayGrid) {
        return;
    }

    if (menuOverlayPreviewImage) {
        menuOverlayPreviewImage.src = category.image || "";
        menuOverlayPreviewImage.alt = category.title;
    }
    menuOverlayTitle.textContent = category.title;
    menuOverlayDescription.textContent = category.description || "";

    menuOverlayGrid.innerHTML = category.items
        .map(
            (product, index) =>
                renderSharedProductCardMarkup({
                    className: `menu-overlay-card product-card ${index % 3 === 2 ? "is-wide" : ""}`.trim(),
                    name: product.name || "",
                    priceDisplay: product.price || category.price,
                    priceAmount: product.numeric_price || 0,
                    description: product.description || category.description || "",
                    image: product.image || "",
                    images: product.images || [],
                    tags: product.tags || [],
                    variantId: product.variant_id || "",
                    meta: product.meta || category.title,
                }),
        )
        .join("");

    if (menuOverlaySearchInput) {
        menuOverlaySearchInput.value = "";
    }
    if (menuOverlaySortSelect) {
        menuOverlaySortSelect.value = "featured";
    }
    applyMenuOverlaySearch();
    menuOverlayGrid.querySelectorAll(".menu-overlay-card").forEach((card) => {
        syncMenuOverlayCardQuantity(card);
    });
};

const closeMenuOverlay = () => {
    menuOverlayShell?.classList.remove("is-open");
    menuOverlayShell?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (menuOverlayPanel) {
        menuOverlayPanel.style.transform = "";
        menuOverlayPanel.style.opacity = "";
    }

    if (menuOverlaySearchInput) {
        menuOverlaySearchInput.value = "";
    }
    if (menuOverlaySortSelect) {
        menuOverlaySortSelect.value = "featured";
    }

    if (lastFocusedCategory) {
        lastFocusedCategory.focus();
    }
};

const openMenuOverlay = (button) => {
    if (!menuOverlayShell || !menuOverlayPanel || !menuOverlayTitle || !menuOverlayDescription || !menuOverlayGrid) {
        return;
    }

    lastFocusedCategory = button;
    const category = categoriesData.find((entry) => entry.key === button.dataset.categoryKey);
    renderMenuOverlay(category);

    menuOverlayShell.classList.add("is-open");
    menuOverlayShell.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
        animatePanelFromCategory(button);
    });
};

const openDetail = (card) => {
    const images = (card.dataset.productImages || "").split("|").filter(Boolean);
    const tags = Array.from(card.querySelectorAll(".product-categories li")).map((tag) => tag.textContent.trim());
    activeProduct = getProductData(card);

    detailTitle.textContent = card.dataset.productName || "";
    detailTime.textContent = card.dataset.productType || "";
    detailDescription.textContent = card.dataset.productDescription || "";
    refreshDetailQuantityFromCart();

    detailGallery.innerHTML = images
        .map(
            (src, index) => `
                <div class="product-detail-gallery-item">
                    <img src="${src}" alt="${card.dataset.productName || "Product"} image ${index + 1}">
                </div>
            `,
        )
        .join("");

    detailTags.innerHTML = tags.map((tag) => `<li>${tag}</li>`).join("");

    detailShell.classList.add("is-open");
    detailShell.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    detailPanel?.querySelector(".product-detail-scroll")?.scrollTo({ top: 0 });
    requestAnimationFrame(() => {
        animatePanelFromCard(card);
    });
};

const closeDetail = () => {
    detailShell.classList.remove("is-open");
    detailShell.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (detailPanel) {
        detailPanel.style.transform = "";
        detailPanel.style.opacity = "";
    }

    if (lastFocusedCard) {
        lastFocusedCard.focus();
    }
};

const syncProductCardQuantity = (card) => {
    const product = getProductData(card);
    const quantity = Number(window.getCartItemQuantity?.(product) || 0);
    const addButton = card.querySelector(".product-cart-adding");
    const quantityControl = card.querySelector(".product-card-quantity");
    const quantityValue = card.querySelector(".product-card-quantity-value");

    if (quantityValue) {
        quantityValue.textContent = String(quantity);
    }

    if (quantityControl) {
        quantityControl.hidden = quantity <= 0;
    }

    if (addButton) {
        addButton.hidden = quantity > 0;
    }
};

const syncAllProductCardQuantities = () => {
    productCards.forEach((card) => {
        syncProductCardQuantity(card);
    });
};

const handleShopDeepLink = () => {
    const params = new URLSearchParams(window.location.search);
    const productHandle = normalizeText(params.get("product"));
    const searchQuery = params.get("search") || "";
    const focusSearch = params.get("focus") === "search";

    if (searchQuery && shopSearchInput) {
        shopSearchInput.value = searchQuery;
        applyShopFilters();
    }

    if (focusSearch && shopSearchInput) {
        window.setTimeout(() => {
            if (isMobileShopViewport()) {
                openMobileShopControls();
            }
            shopSearchInput.focus();
            shopSearchInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 160);
    }

    if (!productHandle) {
        return;
    }

    const matchingCard = filterableCards.find(
        (card) => normalizeText(card.dataset.productHandle) === productHandle,
    );

    if (!matchingCard) {
        return;
    }

    matchingCard.classList.remove("is-hidden");
    matchingCard.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(() => {
        lastFocusedCard = matchingCard;
        openDetail(matchingCard);
    }, 280);
};

productCards.forEach((card) => {
    card.addEventListener("click", (event) => {
        // Ignore direct interaction with internal buttons.
        if (event.target.closest("button")) {
            return;
        }

        lastFocusedCard = card;
        openDetail(card);
    });

    const viewButton = card.querySelector(".product-cart-adding");
    if (viewButton) {
        viewButton.addEventListener("click", (event) => {
            event.stopPropagation();
            const product = getProductData(card);
            const currentQuantity = Number(window.getCartItemQuantity?.(product) || 0);
            window.setCartItemQuantity?.(product, currentQuantity + 1);
            syncProductCardQuantity(card);
        });
    }

    const quantityControl = card.querySelector(".product-card-quantity");
    quantityControl?.addEventListener("click", (event) => {
        const button = event.target.closest(".product-card-quantity-btn");
        if (!button) {
            return;
        }

        event.stopPropagation();
        const product = getProductData(card);
        const currentQuantity = Number(window.getCartItemQuantity?.(product) || 0);
        const nextQuantity =
            button.dataset.action === "increment"
                ? currentQuantity + 1
                : Math.max(0, currentQuantity - 1);

        window.setCartItemQuantity?.(product, nextQuantity);
        syncProductCardQuantity(card);
    });

    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            lastFocusedCard = card;
            openDetail(card);
        }
    });

    syncProductCardQuantity(card);
});

detailBackdrop?.addEventListener("click", closeDetail);
detailClose?.addEventListener("click", closeDetail);
detailQuantityDecrement?.addEventListener("click", () => {
    if (!activeProduct) {
        return;
    }

    activeDetailQuantity = Math.max(0, activeDetailQuantity - 1);
    window.setCartItemQuantity?.(activeProduct, activeDetailQuantity);
    syncDetailQuantity();
});
detailQuantityIncrement?.addEventListener("click", () => {
    if (!activeProduct) {
        return;
    }

    activeDetailQuantity += 1;
    window.setCartItemQuantity?.(activeProduct, activeDetailQuantity);
    syncDetailQuantity();
});
detailCartButton?.addEventListener("click", () => {
    if (activeProduct) {
        activeDetailQuantity = 1;
        window.setCartItemQuantity?.(activeProduct, activeDetailQuantity);
        syncDetailQuantity();
    }
});

window.addEventListener("omzhana-cart-updated", () => {
    syncAllProductCardQuantities();
    menuOverlayGrid?.querySelectorAll(".menu-overlay-card").forEach((card) => {
        syncMenuOverlayCardQuantity(card);
    });

    if (!detailShell?.classList.contains("is-open") || !activeProduct) {
        return;
    }

    refreshDetailQuantityFromCart();
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
        return;
    }

    if (shopProductsSection?.classList.contains("is-mobile-controls-open")) {
        closeMobileShopControls();
    }

    if (detailShell?.classList.contains("is-open")) {
        closeDetail();
    }

    if (menuOverlayShell?.classList.contains("is-open")) {
        closeMenuOverlay();
    }
});

detailPanel?.addEventListener("click", (event) => {
    event.stopPropagation();
});

menuOverlayBackdrop?.addEventListener("click", closeMenuOverlay);
menuOverlayClose?.addEventListener("click", closeMenuOverlay);
menuOverlayPanel?.addEventListener("click", (event) => {
    event.stopPropagation();
});

menuOverlayGrid?.addEventListener("click", (event) => {
    const addButton = event.target.closest(".product-cart-adding");
    if (addButton) {
        const card = addButton.closest(".menu-overlay-card");
        if (!card) {
            return;
        }

        const product = getMenuOverlayProductData(card);
        const currentQuantity = Number(window.getCartItemQuantity?.(product) || 0);
        window.setCartItemQuantity?.(product, currentQuantity + 1);
        syncMenuOverlayCardQuantity(card);
        return;
    }

    const quantityButton = event.target.closest(".product-card-quantity-btn");
    if (quantityButton) {
        const card = quantityButton.closest(".menu-overlay-card");
        if (!card) {
            return;
        }

        const product = getMenuOverlayProductData(card);
        const currentQuantity = Number(window.getCartItemQuantity?.(product) || 0);
        const nextQuantity =
            quantityButton.dataset.action === "increment"
                ? currentQuantity + 1
                : Math.max(0, currentQuantity - 1);

        window.setCartItemQuantity?.(product, nextQuantity);
        syncMenuOverlayCardQuantity(card);
        return;
    }

    const card = event.target.closest(".menu-overlay-card");
    if (!card) {
        return;
    }

    openDetailFromPayload(
        {
            name: card.dataset.productName || "",
            description: card.dataset.productDescription || "",
            priceDisplay: card.dataset.productPriceDisplay || "",
            numericPrice: Number(card.dataset.productPriceAmount || 0),
            image: card.dataset.productImage || "",
            images: (card.dataset.productImages || "").split("|").filter(Boolean),
            tags: (card.dataset.productTags || "").split("|").filter(Boolean),
            variantId: card.dataset.productVariantId || "",
            meta: card.dataset.productMeta || "",
        },
        card,
    );
});

menuOverlayGrid?.addEventListener("keydown", (event) => {
    const card = event.target.closest(".menu-overlay-card");
    if (!card) {
        return;
    }

    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetailFromPayload(
            {
                name: card.dataset.productName || "",
                description: card.dataset.productDescription || "",
                priceDisplay: card.dataset.productPriceDisplay || "",
                numericPrice: Number(card.dataset.productPriceAmount || 0),
                image: card.dataset.productImage || "",
                images: (card.dataset.productImages || "").split("|").filter(Boolean),
                tags: (card.dataset.productTags || "").split("|").filter(Boolean),
                variantId: card.dataset.productVariantId || "",
                meta: card.dataset.productMeta || "",
            },
            card,
        );
    }
});

menuOverlaySearchInput?.addEventListener("input", applyMenuOverlaySearch);
menuOverlaySearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
        return;
    }

    event.preventDefault();
    applyMenuOverlaySearch();
});
menuOverlaySearchButton?.addEventListener("click", applyMenuOverlaySearch);
menuOverlaySortSelect?.addEventListener("change", applyMenuOverlaySearch);

shopMobileControlsTrigger?.addEventListener("click", () => {
    if (shopProductsSection?.classList.contains("is-mobile-controls-open")) {
        closeMobileShopControls();
        return;
    }

    openMobileShopControls();
    window.setTimeout(() => {
        shopSearchInput?.focus();
    }, 120);
});

shopMobileControlsClose?.addEventListener("click", closeMobileShopControls);
shopControlsBackdrop?.addEventListener("click", closeMobileShopControls);

shopCategoryFilters?.addEventListener("click", (event) => {
    const button = event.target.closest(".shop-filter-chip");
    if (!button) {
        return;
    }

    activeShopCategory = button.dataset.filterCategory || "all";
    shopCategoryFilters.querySelectorAll(".shop-filter-chip").forEach((chip) => {
        chip.classList.toggle("is-active", chip === button);
    });
    applyShopFilters();
    if (isMobileShopViewport()) {
        closeMobileShopControls();
    }
});

shopMobileCategoryFilters?.addEventListener("click", (event) => {
    const button = event.target.closest(".shop-filter-chip");
    if (!button) {
        return;
    }

    activeShopCategory = button.dataset.filterCategory || "all";
    shopCategoryFilters?.querySelectorAll(".shop-filter-chip").forEach((chip) => {
        chip.classList.toggle("is-active", (chip.dataset.filterCategory || "all") === activeShopCategory);
    });
    applyShopFilters();
});

shopSearchInput?.addEventListener("input", applyShopFilters);
shopSearchInput?.addEventListener("input", syncMobileShopControls);
shopMobileSearchInput?.addEventListener("input", () => {
    if (shopSearchInput) {
        shopSearchInput.value = shopMobileSearchInput.value;
    }
    applyShopFilters();
});
shopSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
        return;
    }

    event.preventDefault();
    applyShopFilters();
    if (isMobileShopViewport()) {
        closeMobileShopControls();
    }
});
shopMobileSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
        return;
    }

    event.preventDefault();
    if (shopSearchInput) {
        shopSearchInput.value = shopMobileSearchInput.value;
    }
    applyShopFilters();
});
shopSearchButton?.addEventListener("click", () => {
    applyShopFilters();
    if (isMobileShopViewport()) {
        closeMobileShopControls();
    }
});
shopMobileSearchButton?.addEventListener("click", () => {
    if (shopSearchInput) {
        shopSearchInput.value = shopMobileSearchInput?.value || "";
    }
    applyShopFilters();
});
shopSortSelect?.addEventListener("change", () => {
    applyShopFilters();
    if (isMobileShopViewport()) {
        closeMobileShopControls();
    }
});
shopMobileSortSelect?.addEventListener("change", () => {
    if (shopSortSelect) {
        shopSortSelect.value = shopMobileSortSelect.value;
    }
    applyShopFilters();
});
shopAvailabilitySelect?.addEventListener("change", () => {
    applyShopFilters();
    if (isMobileShopViewport()) {
        closeMobileShopControls();
    }
});
shopMobileAvailabilitySelect?.addEventListener("change", () => {
    if (shopAvailabilitySelect) {
        shopAvailabilitySelect.value = shopMobileAvailabilitySelect.value;
    }
    applyShopFilters();
});

shopResetButton?.addEventListener("click", () => {
    activeShopCategory = "all";
    if (shopSearchInput) {
        shopSearchInput.value = "";
    }
    if (shopSortSelect) {
        shopSortSelect.value = "featured";
    }
    if (shopAvailabilitySelect) {
        shopAvailabilitySelect.value = "all";
    }
    shopCategoryFilters?.querySelectorAll(".shop-filter-chip").forEach((chip) => {
        chip.classList.toggle("is-active", chip.dataset.filterCategory === "all");
    });
    applyShopFilters();
    if (isMobileShopViewport()) {
        closeMobileShopControls();
    }
});

window.addEventListener("resize", () => {
    if (!isMobileShopViewport()) {
        closeMobileShopControls();
    }
});

if (imageTrack) {
    const isOverlayOpen = () =>
        detailShell?.classList.contains("is-open") || menuOverlayShell?.classList.contains("is-open");
    trackPercentage = Number(imageTrack.dataset.percentage || "0");
    renderTrackMovement();
    updateTrackFade();

    window.addEventListener(
        "scroll",
        () => {
            window.requestAnimationFrame(updateTrackFade);
        },
        { passive: true },
    );

    imageTrack.addEventListener("dragstart", (event) => {
        event.preventDefault();
    });

    imageTrack.addEventListener("pointerdown", (event) => {
        if (isOverlayOpen()) {
            return;
        }

        pendingTrackButton = event.target.closest(".category-btn");
        trackMoved = false;
        isDraggingTrack = true;
        dragStartX = event.clientX;
        dragStartPercentage = trackPercentage;
        imageTrack.style.cursor = "grabbing";
        imageTrack.setPointerCapture?.(event.pointerId);
    });

    imageTrack.addEventListener("pointermove", (event) => {
        if (!isDraggingTrack || isOverlayOpen()) {
            return;
        }

        const mouseDelta = dragStartX - event.clientX;
        if (Math.abs(mouseDelta) > 6) {
            trackMoved = true;
        }
        const maxDelta = window.innerWidth / 2;
        const percentage = (mouseDelta / maxDelta) * -100;
        applyTrackMovement(dragStartPercentage + percentage);
    });

    const endTrackDrag = (event) => {
        if (!isDraggingTrack) {
            return;
        }

        const clickedButton = pendingTrackButton;
        const shouldOpenOverlay = !trackMoved && clickedButton && !isOverlayOpen();

        isDraggingTrack = false;
        trackMoved = false;
        pendingTrackButton = null;
        imageTrack.style.cursor = "";
        if (event?.pointerId !== undefined) {
            imageTrack.releasePointerCapture?.(event.pointerId);
        }

        if (shouldOpenOverlay) {
            openMenuOverlay(clickedButton);
        }
    };

    imageTrack.addEventListener("pointerup", endTrackDrag);
    imageTrack.addEventListener("pointercancel", endTrackDrag);
    imageTrack.addEventListener("pointerleave", endTrackDrag);

    imageTrack.addEventListener(
        "wheel",
        (event) => {
            if (isOverlayOpen()) {
                return;
            }

            const horizontalDelta =
                Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0;

            if (horizontalDelta === 0) {
                return;
            }

            event.preventDefault();

            const step = (horizontalDelta / window.innerWidth) * 140;
            const nextPercentage = trackPercentage - step;
            applyTrackMovement(nextPercentage);
        },
        { passive: false },
    );
}

applyShopFilters();
handleShopDeepLink();
