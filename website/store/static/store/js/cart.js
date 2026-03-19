(() => {
    const CART_STORAGE_KEY = "omzhana-cart";

    const cartPageGrid = document.querySelector("#cart-page-grid");
    const cartPageItems = document.querySelector("#cart-page-items");
    const cartPageEmpty = document.querySelector("#cart-page-empty");
    const cartPageCount = document.querySelector("#cart-page-count");
    const cartPageSubtotal = document.querySelector("#cart-page-subtotal");
    const cartPageTotal = document.querySelector("#cart-page-total");
    const cartPageCheckout = document.querySelector("#cart-page-checkout");
    const cartPageClear = document.querySelector("#cart-page-clear");

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

    const formatPrice = (amount) => `$${amount.toFixed(2)}`;

    const itemKeyFor = (item) => `${item.name}::${item.price}`;

    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(";").shift();
        }
        return "";
    };

    const renderCartPage = () => {
        const items = readCart();
        const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

        if (!cartPageGrid || !cartPageItems || !cartPageEmpty) {
            return;
        }

        const hasItems = items.length > 0;
        cartPageGrid.hidden = !hasItems;
        cartPageEmpty.hidden = hasItems;

        if (!hasItems) {
            cartPageItems.innerHTML = "";
            return;
        }

        cartPageItems.innerHTML = items
            .map(
                (item) => `
                    <article class="cart-line">
                        <div class="cart-line-thumb">
                            <img src="${item.image}" alt="${item.name}">
                        </div>
                        <div class="cart-line-copy">
                            <h3>${item.name}</h3>
                            <p>${item.meta || "Added from store"}</p>
                            <p class="cart-line-price">${formatPrice(Number(item.price || 0))}</p>
                        </div>
                        <div class="cart-line-actions">
                            <div class="cart-line-qty">
                                <button type="button" data-action="decrement" data-item-key="${itemKeyFor(item)}">-</button>
                                <span>${item.quantity}</span>
                                <button type="button" data-action="increment" data-item-key="${itemKeyFor(item)}">+</button>
                            </div>
                            <button class="cart-line-remove" type="button" data-action="remove" data-item-key="${itemKeyFor(item)}">
                                Remove
                            </button>
                        </div>
                    </article>
                `,
            )
            .join("");

        if (cartPageCount) {
            const itemCount = items.reduce((count, item) => count + Number(item.quantity || 0), 0);
            cartPageCount.textContent = `${itemCount} product${itemCount === 1 ? "" : "s"}`;
        }

        if (cartPageSubtotal) {
            cartPageSubtotal.textContent = formatPrice(subtotal);
        }

        if (cartPageTotal) {
            cartPageTotal.textContent = formatPrice(subtotal);
        }
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
        } else if (action === "increment") {
            cart[index].quantity += 1;
        }

        writeCart(cart);
        renderCartPage();
    };

    const beginCheckout = async () => {
        const items = readCart();
        const lineItems = items
            .filter((item) => item.variantId)
            .map((item) => ({
                variantId: item.variantId,
                quantity: item.quantity,
            }));

        if (lineItems.length === 0) {
            window.alert("Your cart does not contain any Shopify checkout items yet.");
            return;
        }

        if (cartPageCheckout) {
            cartPageCheckout.disabled = true;
            cartPageCheckout.textContent = "Loading...";
        }

        try {
            const response = await window.fetch("/api/checkout/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ items: lineItems }),
            });
            const payload = await response.json();

            if (!response.ok || !payload.ok || !payload.checkoutUrl) {
                throw new Error(payload.error || "Unable to create Shopify checkout.");
            }

            window.location.href = payload.checkoutUrl;
        } catch (error) {
            window.alert(error.message || "Unable to start checkout right now.");
        } finally {
            if (cartPageCheckout) {
                cartPageCheckout.disabled = false;
                cartPageCheckout.textContent = "Proceed to Checkout";
            }
        }
    };

    cartPageItems?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        updateCartItem(button.dataset.itemKey, button.dataset.action);
    });

    cartPageClear?.addEventListener("click", () => {
        writeCart([]);
        renderCartPage();
    });

    cartPageCheckout?.addEventListener("click", beginCheckout);

    window.addEventListener("storage", renderCartPage);
    window.addEventListener("omzhana-cart-updated", renderCartPage);

    renderCartPage();
})();
