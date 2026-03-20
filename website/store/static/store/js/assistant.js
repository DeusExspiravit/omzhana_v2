(() => {
const assistantCatalogElement = document.querySelector("#assistant-catalog-data");
const assistantTrigger = document.querySelector("#store-assistant-trigger");
const assistantShell = document.querySelector("#store-assistant-shell");
const assistantBackdrop = document.querySelector("#store-assistant-backdrop");
const assistantPanel = document.querySelector("#store-assistant-panel");
const assistantClose = document.querySelector("#store-assistant-close");
const assistantMessages = document.querySelector("#store-assistant-messages");
const assistantForm = document.querySelector("#store-assistant-form");
const assistantInput = document.querySelector("#store-assistant-input");
const assistantQuick = document.querySelector("#store-assistant-quick");
const assistantState = {
    lastMatchedProduct: null,
};
let assistantTypingTimer = null;
let dragStartY = 0;
let dragCurrentY = 0;
let isDraggingAssistant = false;

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

const normalizeAssistantText = (value) => String(value || "").trim().toLowerCase();
const unique = (values) => [...new Set((values || []).filter(Boolean))];

const escapeAssistantHtml = (value) =>
    String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const openAssistant = () => {
    if (!assistantShell) {
        return;
    }

    if (assistantTrigger && assistantPanel) {
        const triggerRect = assistantTrigger.getBoundingClientRect();
        const panelRect = assistantPanel.getBoundingClientRect();
        const originX = Math.max(0, Math.min(panelRect.width, triggerRect.left + triggerRect.width / 2 - panelRect.left));
        const originY = Math.max(0, Math.min(panelRect.height, triggerRect.top + triggerRect.height / 2 - panelRect.top));
        assistantPanel.style.setProperty("--assistant-origin-x", `${originX}px`);
        assistantPanel.style.setProperty("--assistant-origin-y", `${originY}px`);
    }

    assistantShell.classList.add("is-open");
    assistantShell.setAttribute("aria-hidden", "false");
    assistantTrigger?.classList.add("is-hidden");
    document.body.style.overflow = "hidden";
    assistantInput?.focus();
};

const closeAssistant = () => {
    if (!assistantShell) {
        return;
    }

    window.clearTimeout(assistantTypingTimer);
    assistantTypingTimer = null;
    assistantShell.classList.remove("is-open");
    assistantShell.setAttribute("aria-hidden", "true");
    assistantTrigger?.classList.remove("is-hidden");
    document.body.style.overflow = "";
    assistantPanel?.style.removeProperty("transform");
};

const scrollAssistantToBottom = () => {
    assistantMessages?.scrollTo({ top: assistantMessages.scrollHeight, behavior: "smooth" });
};

const assistantBusinessFacts = {
    years: "over 10 years",
    wholesale: "Wholesale is available for retailers, resellers, cafes, stores, and food businesses.",
    trust: "Omzhana is an established food and pantry business focused on reliability, quality products, and dependable service.",
};

const normalizeProductText = (product) =>
    normalizeAssistantText(
        [
            product.title,
            product.description,
            product.category,
            ...(product.tags || []),
            ...(product.dietary || []),
            ...(product.cuisine || []),
            ...(product.use_case || []),
            product.spice_level,
            product.available ? "available in stock available" : "unavailable out of stock",
        ].join(" "),
    );

const productActionMarkup = (product) => {
    const safeTitle = escapeAssistantHtml(product.title);
    const safeCategory = escapeAssistantHtml(product.category);
    const safePrice = escapeAssistantHtml(product.price || "");
    const payload = escapeAssistantHtml(
        JSON.stringify({
            name: product.title,
            price: Number(product.price_amount || 0),
            image: product.image || "",
            meta: product.category || "Store item",
            variantId: product.variant_id || "",
            handle: product.handle || "",
            quantity: 1,
        }),
    );

    return `
        <div class="store-assistant-actions">
            <a class="store-assistant-link" href="/shop/?product=${encodeURIComponent(product.handle || "")}">View in Shop</a>
            <button class="store-assistant-action" type="button" data-assistant-add='${payload}'>Add to Cart</button>
            <a class="store-assistant-action" href="/cart/">Open Cart</a>
        </div>
        <p><strong>${safeTitle}</strong> <span>• ${safeCategory}${safePrice ? ` • ${safePrice}` : ""}</span></p>
    `;
};

const appendAssistantMessage = (role, html) => {
    if (!assistantMessages) {
        return;
    }

    const message = document.createElement("article");
    message.className = `store-assistant-message is-${role}`;
    message.innerHTML = html;
    assistantMessages.appendChild(message);
    scrollAssistantToBottom();
    return message;
};

const appendTypingMessage = () =>
    appendAssistantMessage(
        "assistant is-typing",
        `
            <div class="store-assistant-typing" aria-label="Assistant is typing">
                <span class="store-assistant-typing-dot"></span>
                <span class="store-assistant-typing-dot"></span>
                <span class="store-assistant-typing-dot"></span>
            </div>
        `,
    );

const scoreProduct = (product, query) => {
    const text = normalizeProductText(product);
    const title = normalizeAssistantText(product.title);
    const category = normalizeAssistantText(product.category);

    let score = 0;
    query.split(/\s+/).filter(Boolean).forEach((term) => {
        if (title === term) {
            score += 12;
        } else if (title.includes(term)) {
            score += 5;
        }
        if (category.includes(term)) {
            score += 3;
        }
        if (text.includes(term)) {
            score += 1;
        }
    });

    return score;
};

const findRelevantProducts = (query, limit = 3) =>
    assistantCatalog
        .map((product) => ({ product, score: scoreProduct(product, query) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map((entry) => entry.product);

const findExactProduct = (query) => {
    const normalized = normalizeAssistantText(query);
    if (!normalized) {
        return null;
    }

    return (
        assistantCatalog.find((product) => normalizeAssistantText(product.title) === normalized) ||
        assistantCatalog.find((product) => normalizeAssistantText(product.handle) === normalized) ||
        assistantCatalog.find((product) => normalizeProductText(product).includes(normalized)) ||
        null
    );
};

const recommendProducts = (query) => {
    const products = findRelevantProducts(query, 3);
    if (products.length > 0) {
        return products;
    }

    return assistantCatalog.slice(0, 3);
};

const assistantIntroMarkup = `
    <p>I can help you find products, compare options, suggest pantry picks, answer basic prep or pairing questions, and explain what Omzhana offers for retail or wholesale.</p>
    <p>Try asking for something spicy, a quick meal, a vegan-friendly option, a ramen pairing, a product price, or whether wholesale is available.</p>
`;

const rememberProduct = (product) => {
    assistantState.lastMatchedProduct = product || null;
};

const getConversationProduct = (query) => findExactProduct(query) || assistantState.lastMatchedProduct;

const buildRecommendationResponse = (query, introText = "") => {
    const products = recommendProducts(query);
    const intro = `<p>${introText || `These are the closest catalog matches for <strong>${escapeAssistantHtml(query)}</strong>.`}</p>`;
    const productBlocks = products
        .map((product) => {
            const cues = unique([
                product.category,
                ...(product.use_case || []),
                ...(product.dietary || []),
                product.spice_level ? `${product.spice_level} spice` : "",
            ]).slice(0, 3);
            return `
                <p>${escapeAssistantHtml(product.description || `${product.title} from ${product.category}.`)}${cues.length ? ` <strong>Signals:</strong> ${escapeAssistantHtml(cues.join(", "))}.` : ""}</p>
                ${productActionMarkup(product)}
            `;
        })
        .join("");
    rememberProduct(products[0] || null);
    return `${intro}${productBlocks}`;
};

const buildNutritionResponse = (query) => {
    const match = getConversationProduct(query);
    if (!match) {
        return "<p>I couldn't match that to a specific product. Ask with a product name and I’ll check what the catalog contains.</p><p>Nutrition guidance is only shown when structured nutrition data exists.</p>";
    }

    return `
        <p>I found <strong>${escapeAssistantHtml(match.title)}</strong>, but Omzhana’s current catalog does not include structured nutrition fields for it.</p>
        <p>So I can’t give reliable nutrition numbers here. If nutrition is critical, please verify it from the product packaging or a confirmed supplier source.</p>
        ${productActionMarkup(match)}
    `;
};

const buildPreparationResponse = (query) => {
    const match = getConversationProduct(query);
    if (!match) {
        return buildRecommendationResponse(query);
    }

    const useCase = unique(match.use_case || []).join(", ");
    const category = escapeAssistantHtml(match.category || "store item");
    return `
        <p>For <strong>${escapeAssistantHtml(match.title)}</strong>, the storefront suggests ${category.toLowerCase()} use with this guidance: ${escapeAssistantHtml(match.description || "no preparation guidance is currently listed in the catalog")}.</p>
        <p>${useCase ? `Best use-case signals: ${escapeAssistantHtml(useCase)}. ` : ""}If you need exact cooking steps or ingredient proportions, I can only rely on the catalog and product packaging, not invent unsupported instructions.</p>
        ${productActionMarkup(match)}
    `;
};

const buildPairingResponse = (query) => {
    const products = recommendProducts(query);
    return `
        <p>Based on the catalog, these pair well with that use case or flavor direction:</p>
        ${products
            .map(
                (product) => `
                    <p><strong>${escapeAssistantHtml(product.title)}</strong>: ${escapeAssistantHtml(product.description || `${product.category} option.`)}</p>
                    ${productActionMarkup(product)}
                `,
            )
            .join("")}
    `;
};

const buildIngredientResponse = (query) => {
    const match = getConversationProduct(query);
    if (!match) {
        return "<p>I can help if you ask with a product name. Ingredient guidance is limited to what’s evident from the structured catalog fields, title, tags, and description.</p>";
    }

    const tags = (match.tags || []).slice(0, 4);
    return `
        <p>For <strong>${escapeAssistantHtml(match.title)}</strong>, the catalog gives these signals: <strong>${escapeAssistantHtml(match.category)}</strong>${tags.length ? `, with tags like ${escapeAssistantHtml(tags.join(", "))}` : ""}.</p>
        <p>I don’t see a full structured ingredient list in the product data, so treat this as discovery guidance rather than an exact ingredient label.</p>
        ${productActionMarkup(match)}
    `;
};

const buildAvailabilityResponse = (query) => {
    const match = getConversationProduct(query);
    if (!match) {
        return buildRecommendationResponse(query, "I couldn’t pin that to one product yet, but these are the closest matches.");
    }

    rememberProduct(match);
    return `
        <p><strong>${escapeAssistantHtml(match.title)}</strong> is currently marked as <strong>${match.available ? "available" : "unavailable"}</strong> in the storefront.</p>
        <p>Price shown right now: <strong>${escapeAssistantHtml(match.price || "Unavailable")}</strong>.</p>
        ${productActionMarkup(match)}
    `;
};

const buildPriceResponse = (query) => {
    const match = getConversationProduct(query);
    if (!match) {
        return buildRecommendationResponse(query, "I couldn’t isolate one exact product from that question, but these are likely matches.");
    }

    rememberProduct(match);
    return `
        <p><strong>${escapeAssistantHtml(match.title)}</strong> is listed at <strong>${escapeAssistantHtml(match.price || "price unavailable")}</strong>.</p>
        <p>${match.available ? "It is also currently marked available in the storefront." : "It is currently marked unavailable in the storefront."}</p>
        ${productActionMarkup(match)}
    `;
};

const buildWholesaleResponse = () => `
    <p>Yes. ${assistantBusinessFacts.wholesale}</p>
    <p>Omzhana has been serving customers for ${assistantBusinessFacts.years}, so the online store is an extension of an established business rather than a new startup.</p>
    <div class="store-assistant-actions">
        <a class="store-assistant-link" href="/about/#about-location">Contact for Wholesale</a>
        <a class="store-assistant-action" href="/about/">About Omzhana</a>
    </div>
`;

const buildStoreInfoResponse = () => `
    <p>${assistantBusinessFacts.trust}</p>
    <p>Omzhana has been serving trusted food and pantry products for ${assistantBusinessFacts.years}, with both retail and wholesale supply available.</p>
    <div class="store-assistant-actions">
        <a class="store-assistant-link" href="/shop/">Browse Products</a>
        <a class="store-assistant-action" href="/about/">About Omzhana</a>
    </div>
`;

const buildCategoryResponse = (query) => {
    const normalized = normalizeAssistantText(query);
    const matchingProducts = assistantCatalog
        .filter((product) =>
            [product.category, ...(product.cuisine || []), ...(product.use_case || []), ...(product.dietary || [])]
                .map((value) => normalizeAssistantText(value))
                .some((value) => value && normalized.includes(value)),
        )
        .slice(0, 3);

    if (matchingProducts.length === 0) {
        return buildRecommendationResponse(query);
    }

    rememberProduct(matchingProducts[0]);
    return `
        <p>These fit that category or use case best:</p>
        ${matchingProducts
            .map(
                (product) => `
                    <p><strong>${escapeAssistantHtml(product.title)}</strong>: ${escapeAssistantHtml(product.description || product.category)}</p>
                    ${productActionMarkup(product)}
                `,
            )
            .join("")}
    `;
};

const medicalTerms = ["treat", "cure", "diagnose", "diabetes", "blood pressure", "cholesterol", "weight loss", "medical"];

const generateAssistantReply = (query) => {
    const normalized = normalizeAssistantText(query);
    if (!normalized) {
        return assistantIntroMarkup;
    }

    if (medicalTerms.some((term) => normalized.includes(term))) {
        return "<p>I can help with product discovery and catalog-based food guidance, but I can’t provide medical advice or health claims.</p><p>If you need medical or dietary treatment guidance, please use a qualified professional source.</p>";
    }

    if (normalized.includes("hello") || normalized.includes("help") || normalized.includes("what can you do")) {
        return assistantIntroMarkup;
    }

    if (
        normalized.includes("wholesale") ||
        normalized.includes("bulk") ||
        normalized.includes("reseller") ||
        normalized.includes("retailer") ||
        normalized.includes("cafe") ||
        normalized.includes("store supply")
    ) {
        return buildWholesaleResponse();
    }

    if (
        normalized.includes("about omzhana") ||
        normalized.includes("about the store") ||
        normalized.includes("who are you") ||
        normalized.includes("how long") ||
        normalized.includes("years") ||
        normalized.includes("trusted")
    ) {
        return buildStoreInfoResponse();
    }

    if (
        normalized.includes("price") ||
        normalized.includes("cost") ||
        normalized.includes("how much")
    ) {
        return buildPriceResponse(query);
    }

    if (
        normalized.includes("available") ||
        normalized.includes("in stock") ||
        normalized.includes("out of stock")
    ) {
        return buildAvailabilityResponse(query);
    }

    if (normalized.includes("nutrition") || normalized.includes("calories") || normalized.includes("protein")) {
        return buildNutritionResponse(query);
    }

    if (normalized.includes("ingredient") || normalized.includes("what is in") || normalized.includes("allergen")) {
        return buildIngredientResponse(query);
    }

    if (normalized.includes("cook") || normalized.includes("prepare") || normalized.includes("how do i make") || normalized.includes("how do i use")) {
        return buildPreparationResponse(query);
    }

    if (normalized.includes("pair") || normalized.includes("go with") || normalized.includes("serve with")) {
        return buildPairingResponse(query);
    }

    if (
        normalized.includes("recommend") ||
        normalized.includes("show me") ||
        normalized.includes("looking for") ||
        normalized.includes("category") ||
        normalized.includes("spicy") ||
        normalized.includes("vegan") ||
        normalized.includes("vegetarian") ||
        normalized.includes("gluten-free") ||
        normalized.includes("gluten free") ||
        normalized.includes("quick") ||
        normalized.includes("snack") ||
        normalized.includes("dessert") ||
        normalized.includes("drink") ||
        normalized.includes("ramen") ||
        normalized.includes("rice") ||
        normalized.includes("tofu")
    ) {
        return buildCategoryResponse(query);
    }

    const exactMatch = findExactProduct(query);
    if (exactMatch) {
        rememberProduct(exactMatch);
        return `
            <p><strong>${escapeAssistantHtml(exactMatch.title)}</strong> is in the catalog under <strong>${escapeAssistantHtml(exactMatch.category)}</strong>.</p>
            <p>${escapeAssistantHtml(exactMatch.description || "No extra description is currently listed.")}</p>
            ${productActionMarkup(exactMatch)}
        `;
    }

    const directMatches = findRelevantProducts(query, 3);
    if (directMatches.length > 0) {
        return buildRecommendationResponse(query);
    }

    return "<p>I couldn’t match that cleanly to the current catalog. Try a product type, flavor direction, use case, spice level, or dietary preference.</p><p>Examples: <strong>something spicy</strong>, <strong>quick meal</strong>, <strong>vegan-friendly</strong>, or <strong>what pairs with ramen</strong>.</p>";
};

assistantTrigger?.addEventListener("click", openAssistant);
assistantBackdrop?.addEventListener("click", closeAssistant);
assistantClose?.addEventListener("click", closeAssistant);
assistantPanel?.addEventListener("click", (event) => event.stopPropagation());

assistantQuick?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-assistant-prompt]");
    if (!button || !assistantInput) {
        return;
    }

    assistantInput.value = button.dataset.assistantPrompt || "";
    assistantForm?.requestSubmit();
});

assistantForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = assistantInput?.value?.trim() || "";
    if (!query) {
        return;
    }

    appendAssistantMessage("user", `<p>${escapeAssistantHtml(query)}</p>`);
    const typingMessage = appendTypingMessage();
    window.clearTimeout(assistantTypingTimer);
    assistantTypingTimer = window.setTimeout(() => {
        typingMessage?.remove();
        appendAssistantMessage("assistant", generateAssistantReply(query));
    }, 320);
    if (assistantInput) {
        assistantInput.value = "";
    }
});

assistantMessages?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-assistant-add]");
    if (!button) {
        return;
    }

    try {
        const payload = JSON.parse(button.dataset.assistantAdd || "{}");
        window.addToCart?.(payload);
    } catch (error) {
        // no-op
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && assistantShell?.classList.contains("is-open")) {
        closeAssistant();
    }
});

const resetAssistantDrag = () => {
    isDraggingAssistant = false;
    dragStartY = 0;
    dragCurrentY = 0;
    if (assistantPanel && assistantShell?.classList.contains("is-open")) {
        assistantPanel.style.transform = "";
    }
};

assistantPanel?.addEventListener(
    "touchstart",
    (event) => {
        if (!assistantShell?.classList.contains("is-open") || window.innerWidth > 900) {
            return;
        }

        const touch = event.touches[0];
        dragStartY = touch.clientY;
        dragCurrentY = touch.clientY;
        isDraggingAssistant = true;
    },
    { passive: true },
);

assistantPanel?.addEventListener(
    "touchmove",
    (event) => {
        if (!isDraggingAssistant || !assistantPanel || window.innerWidth > 900) {
            return;
        }

        const touch = event.touches[0];
        dragCurrentY = touch.clientY;
        const rawDelta = Math.max(0, dragCurrentY - dragStartY);
        const resistedDelta = rawDelta > 0 ? rawDelta * 0.82 : 0;
        assistantPanel.style.transform = `translateY(${resistedDelta}px) scale(${Math.max(0.96, 1 - rawDelta / 1200)})`;
    },
    { passive: true },
);

assistantPanel?.addEventListener("touchend", () => {
    if (!isDraggingAssistant || !assistantPanel || window.innerWidth > 900) {
        resetAssistantDrag();
        return;
    }

    const delta = Math.max(0, dragCurrentY - dragStartY);
    if (delta > 120) {
        closeAssistant();
    } else {
        assistantPanel.style.transform = "";
    }
    resetAssistantDrag();
});

assistantPanel?.addEventListener("touchcancel", resetAssistantDrag);

if (assistantMessages && assistantCatalog.length > 0) {
    appendAssistantMessage("assistant", assistantIntroMarkup);
}

window.openStoreAssistant = openAssistant;
window.closeStoreAssistant = closeAssistant;
})();
