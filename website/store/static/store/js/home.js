const rotatingProductsElement = document.querySelector("#home-rotating-products-data");
const rotatingCards = Array.from(document.querySelectorAll(".home-rotating-card"));

const rotatingProducts = (() => {
    if (!rotatingProductsElement?.textContent) {
        return [];
    }

    try {
        return JSON.parse(rotatingProductsElement.textContent);
    } catch (error) {
        return [];
    }
})();

let rotatingIntervalId = null;
let visibleProductKeys = [];
let shuffleTimeoutId = null;
const shuffleFadeOutMs = 280;
const shuffleFadeInMs = 320;

const renderRotatingCard = (card, item) => {
    if (!card || !item) {
        return;
    }

    const image = card.querySelector("img");
    const title = card.querySelector(".featured-card-title");
    const price = card.querySelector(".featured-card-price");
    const tags = card.querySelector(".featured-card-tags");

    if (image) {
        image.src = item.image || "";
        image.alt = item.title || item.category || "Featured product";
    }
    if (title) {
        title.textContent = item.title || "";
    }
    if (price) {
        price.textContent = item.price || "$0.00";
    }
    if (tags) {
        tags.innerHTML = (item.labels || [])
            .slice(0, 3)
            .map((label) => `<li>${label}</li>`)
            .join("");
    }

    card.dataset.productName = item.title || "";
    card.dataset.productPrice = String(item.price_amount || 0);
    card.dataset.productVariantId = item.variant_id || "";
    card.dataset.productHandle = item.handle || "";
    card.dataset.productType = item.category || "Featured";
};

const shuffleProducts = (items) => {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
};

const getProductKey = (item) => item?.variant_id || item?.handle || item?.title || "";

const pickVisibleProducts = () => {
    const visibleCount = Math.min(rotatingCards.length, rotatingProducts.length);

    if (visibleCount === 0) {
        return [];
    }

    if (rotatingProducts.length <= visibleCount) {
        return rotatingProducts.slice(0, visibleCount);
    }

    let nextItems = [];
    let attempts = 0;

    while (attempts < 6) {
        nextItems = shuffleProducts(rotatingProducts).slice(0, visibleCount);
        const nextKeys = nextItems.map(getProductKey);

        if (nextKeys.join("|") !== visibleProductKeys.join("|")) {
            return nextItems;
        }

        attempts += 1;
    }

    return nextItems;
};

const renderRotatingCards = (items) => {
    items.forEach((item, index) => {
        renderRotatingCard(rotatingCards[index], item);
    });

    visibleProductKeys = items.map(getProductKey);
};

const animateRotatingCards = (items) => {
    if (shuffleTimeoutId !== null) {
        window.clearTimeout(shuffleTimeoutId);
        shuffleTimeoutId = null;
    }

    rotatingCards.forEach((card) => {
        card.classList.remove("is-shuffling-in");
        card.classList.add("is-shuffling-out");
    });

    shuffleTimeoutId = window.setTimeout(() => {
        renderRotatingCards(items);

        rotatingCards.forEach((card) => {
            card.classList.remove("is-shuffling-out");
            void card.offsetWidth;
            card.classList.add("is-shuffling-in");
        });

        shuffleTimeoutId = window.setTimeout(() => {
            rotatingCards.forEach((card) => {
                card.classList.remove("is-shuffling-in");
            });
            shuffleTimeoutId = null;
        }, shuffleFadeInMs);
    }, shuffleFadeOutMs);
};

const startRotatingCards = () => {
    if (rotatingProducts.length <= rotatingCards.length) {
        return;
    }

    rotatingIntervalId = window.setInterval(() => {
        animateRotatingCards(pickVisibleProducts());
    }, 5000);
};

if (rotatingCards.length > 0 && rotatingProducts.length > 0) {
    renderRotatingCards(pickVisibleProducts());
    startRotatingCards();

    rotatingCards.forEach((card) => {
        card.addEventListener("mouseenter", () => {
            if (rotatingIntervalId !== null) {
                window.clearInterval(rotatingIntervalId);
                rotatingIntervalId = null;
            }
        });

        card.addEventListener("mouseleave", () => {
            if (rotatingIntervalId === null) {
                startRotatingCards();
            }
        });
    });
}
