import json
from collections import OrderedDict
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.shortcuts import render
from django.utils.text import slugify
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt

from .shopify_client import shopify_graphql, shopify_is_configured
from .shopify_queries import CART_CREATE, PRODUCTS_QUERY


FALLBACK_PRODUCTS = [
    {
        "id": "fallback-1",
        "title": "Shin ramen",
        "handle": "shin-ramen",
        "description": "Rich broth, springy noodles, and a bold spicy finish for quick comfort.",
        "product_type": "Ramen",
        "tags": ["instant noodle", "nongshim", "spicy"],
        "featured_image": "/static/store/images/shin_ramen.png",
        "images": [
            {"url": "/static/store/images/shin_ramen.png", "alt": "Shin ramen"},
            {"url": "/static/store/images/food_1.jpg", "alt": "Shin ramen bowl"},
            {"url": "/static/store/images/food_2.jpg", "alt": "Shin ramen ingredients"},
        ],
        "price_amount": "10.00",
        "price_value": 10.0,
        "price_display": "$10.00",
        "currency": "USD",
        "variant_id": "",
        "variant_title": "Default Title",
        "available": True,
    },
    {
        "id": "fallback-2",
        "title": "Street rice",
        "handle": "street-rice",
        "description": "Wok-tossed rice plate with deep umami, heat, and crunch.",
        "product_type": "Rice Bowls",
        "tags": ["savory", "wok", "comfort"],
        "featured_image": "/static/store/images/food_1.jpg",
        "images": [
            {"url": "/static/store/images/food_1.jpg", "alt": "Street rice"},
            {"url": "/static/store/images/food_6.jpg", "alt": "Rice bowl"},
        ],
        "price_amount": "15.00",
        "price_value": 15.0,
        "price_display": "$15.00",
        "currency": "USD",
        "variant_id": "",
        "variant_title": "Default Title",
        "available": True,
    },
    {
        "id": "fallback-3",
        "title": "Fried bites",
        "handle": "fried-bites",
        "description": "Crisp snacks and share plates built for late-night cravings.",
        "product_type": "Snacks",
        "tags": ["crispy", "shareable", "snack"],
        "featured_image": "/static/store/images/food_2.jpg",
        "images": [
            {"url": "/static/store/images/food_2.jpg", "alt": "Fried bites"},
            {"url": "/static/store/images/food_3.jpg", "alt": "Fried bites detail"},
        ],
        "price_amount": "14.00",
        "price_value": 14.0,
        "price_display": "$14.00",
        "currency": "USD",
        "variant_id": "",
        "variant_title": "Default Title",
        "available": True,
    },
    {
        "id": "fallback-4",
        "title": "Cafe drink",
        "handle": "cafe-drink",
        "description": "Cold brew finish with a sweet cafe-style pour.",
        "product_type": "Drinks",
        "tags": ["cold brew", "sweet", "cafe"],
        "featured_image": "/static/store/images/food_5.jpg",
        "images": [
            {"url": "/static/store/images/food_5.jpg", "alt": "Cafe drink"},
            {"url": "/static/store/images/food_8.jpg", "alt": "Cafe drink detail"},
        ],
        "price_amount": "9.00",
        "price_value": 9.0,
        "price_display": "$9.00",
        "currency": "USD",
        "variant_id": "",
        "variant_title": "Default Title",
        "available": True,
    },
]

DEFAULT_TRACK_CATEGORIES = [
    {
        "key": "ramen",
        "title": "Ramen",
        "description": "Brothy comfort bowls with layered spice and springy noodles.",
        "price": "Rp. 12k",
        "image": "/static/store/images/food_0.jpg",
    },
    {
        "key": "street-rice",
        "title": "Street Rice",
        "description": "Wok-tossed rice plates with deep umami, heat, and crunch.",
        "price": "Rp. 15k",
        "image": "/static/store/images/food_1.jpg",
    },
    {
        "key": "fried-bites",
        "title": "Fried Bites",
        "description": "Crisp snacks and share plates built for late-night cravings.",
        "price": "Rp. 14k",
        "image": "/static/store/images/food_2.jpg",
    },
    {
        "key": "dessert-lab",
        "title": "Dessert Lab",
        "description": "Warm finishes, cream, sugar, and textures worth saving room for.",
        "price": "Rp. 18k",
        "image": "/static/store/images/food_3.jpg",
    },
    {
        "key": "chef-specials",
        "title": "Chef Specials",
        "description": "Rotating standouts and richer signature plates from the kitchen.",
        "price": "Rp. 20k",
        "image": "/static/store/images/food_4.jpg",
    },
    {
        "key": "cafe-drinks",
        "title": "Cafe Drinks",
        "description": "Cold brews, shaken drinks, and sweet cafe-style pours.",
        "price": "Rp. 10k",
        "image": "/static/store/images/food_5.jpg",
    },
    {
        "key": "rice-bowls",
        "title": "Rice Bowls",
        "description": "Layered bowls with pickles, sauces, proteins, and contrast.",
        "price": "Rp. 16k",
        "image": "/static/store/images/food_6.jpg",
    },
    {
        "key": "quick-meals",
        "title": "Quick Meals",
        "description": "Fast favorites for grab-and-go lunches or easy dinner wins.",
        "price": "Rp. 13k",
        "image": "/static/store/images/food_7.jpg",
    },
]


def _get_company_details() -> dict:
    return {
        "headline": "Comfort food, curated pantry picks, and a storefront built around everyday cravings.",
        "story": (
            "Omzhana Store is positioned as a neighborhood-first food and essentials company that brings together "
            "ready-to-enjoy dishes, snackable favorites, and shelf-friendly staples in one storefront."
        ),
        "mission": (
            "The focus is simple: offer warm, familiar products that feel easy to discover, easy to order, "
            "and consistent across the online store experience."
        ),
        "address_name": "Omzhana Residence and Storefront",
        "address_lines": [
            "A4, Amrit Nagar",
            "South Extension Part 1",
            "New Delhi, 110003",
            "India",
        ],
        "phone": "+91 90000 00000",
        "email": "hello@omzhana.com",
        "hours": "Mon-Sat, 10:00 AM to 9:00 PM",
        "map_embed_url": (
            "https://www.google.com/maps?q=A4%2C%20Amrit%20Nagar%2C%20South%20Extension%20Part%201%2C%20New%20Delhi%20110003&output=embed"
        ),
    }


def _format_money(amount: str | int | float, currency: str) -> str:
    try:
        value = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError):
        value = Decimal("0.00")

    symbol = "$" if currency == "USD" else f"{currency} "
    return f"{symbol}{value.quantize(Decimal('0.01'))}"


def _normalize_product(node: dict) -> dict:
    variants = node.get("variants", {}).get("edges", [])
    variant_node = next((edge["node"] for edge in variants if edge["node"].get("availableForSale")), None)
    if variant_node is None and variants:
        variant_node = variants[0]["node"]

    price = variant_node.get("price", {}) if variant_node else {}
    amount = price.get("amount", "0")
    currency = price.get("currencyCode", "USD")

    images = [
        {
            "url": image_edge["node"]["url"],
            "alt": image_edge["node"].get("altText") or node.get("title") or "Product image",
        }
        for image_edge in node.get("images", {}).get("edges", [])
        if image_edge.get("node", {}).get("url")
    ]

    featured_image = node.get("featuredImage", {})
    if featured_image.get("url"):
        primary_image = {
            "url": featured_image["url"],
            "alt": featured_image.get("altText") or node.get("title") or "Product image",
        }
        if not images or images[0]["url"] != primary_image["url"]:
            images.insert(0, primary_image)

    price_value = float(amount) if str(amount).replace(".", "", 1).isdigit() else 0.0

    return {
        "id": node.get("id", ""),
        "title": node.get("title", ""),
        "handle": node.get("handle", ""),
        "description": node.get("description", ""),
        "product_type": node.get("productType") or "Featured",
        "tags": node.get("tags") or [],
        "featured_image": images[0]["url"] if images else "",
        "images": images,
        "price_amount": str(amount),
        "price_value": price_value,
        "price_display": _format_money(amount, currency),
        "currency": currency,
        "variant_id": variant_node.get("id", "") if variant_node else "",
        "variant_title": variant_node.get("title", "") if variant_node else "",
        "available": bool(variant_node.get("availableForSale", True)) if variant_node else False,
    }


def _fetch_store_products(limit: int = 24) -> tuple[list[dict], str | None]:
    if not shopify_is_configured():
        return FALLBACK_PRODUCTS, "Shopify Storefront API is not configured. Using local sample data."

    try:
        data = shopify_graphql(PRODUCTS_QUERY, {"first": limit})
        products = [_normalize_product(edge["node"]) for edge in data["products"]["edges"]]
    except Exception as error:  # noqa: BLE001
        return FALLBACK_PRODUCTS, f"Shopify fetch failed: {error}"

    return products or FALLBACK_PRODUCTS, None


def _build_category_payload(products: list[dict], limit: int = 8) -> list[dict]:
    grouped: OrderedDict[str, list[dict]] = OrderedDict()
    for product in products:
        category_name = product["product_type"] or "Featured"
        grouped.setdefault(category_name, []).append(product)

    categories = []
    for category_name, category_products in list(grouped.items())[:limit]:
        hero_product = category_products[0]
        categories.append(
            {
                "key": slugify(category_name) or f"category-{len(categories) + 1}",
                "title": category_name,
                "description": hero_product["description"] or f"Explore {category_name.lower()} from the storefront.",
                "price": hero_product["price_display"],
                "image": hero_product["featured_image"],
                "items": [
                    {
                        "name": product["title"],
                        "description": product["description"],
                        "price": product["price_display"],
                        "numeric_price": product["price_value"],
                        "image": product["featured_image"],
                        "images": product["images"],
                        "tags": product["tags"],
                        "variant_id": product["variant_id"],
                        "meta": product["product_type"],
                    }
                    for product in category_products[:6]
                ],
            }
        )

    if len(categories) >= 4:
        return categories

    # Shopify stores often leave productType blank; keep the visual track intact by
    # falling back to the original curated menu categories and map live products into them.
    fallback_categories = []
    for index, base_category in enumerate(DEFAULT_TRACK_CATEGORIES[:limit]):
        start = index % max(len(products), 1)
        rotated_products = products[start:] + products[:start]
        category_products = rotated_products[: min(4, len(products))] or FALLBACK_PRODUCTS[:3]
        fallback_categories.append(
            {
                **base_category,
                "items": [
                    {
                        "name": product["title"],
                        "description": product["description"],
                        "price": product["price_display"],
                        "numeric_price": product["price_value"],
                        "image": product["featured_image"] or base_category["image"],
                        "images": product["images"],
                        "tags": product["tags"],
                        "variant_id": product["variant_id"],
                        "meta": product["product_type"],
                    }
                    for product in category_products
                ],
            }
        )

    return fallback_categories


def _infer_assistant_facets(product: dict) -> dict:
    text = " ".join(
        [
            product.get("title", ""),
            product.get("description", ""),
            product.get("product_type", ""),
            " ".join(product.get("tags", [])),
        ]
    ).lower()

    dietary = []
    if any(term in text for term in ["vegan", "plant", "plant-based", "tofu"]):
        dietary.append("vegan-friendly")
    if any(term in text for term in ["vegetarian", "veggie", "vegetable", "tofu"]):
        dietary.append("vegetarian-friendly")
    if "gluten-free" in text or "gluten free" in text:
        dietary.append("gluten-free")
    if "dairy-free" in text or "dairy free" in text:
        dietary.append("dairy-free")

    if any(term in text for term in ["extra hot", "very spicy", "hot"]):
        spice_level = "hot"
    elif any(term in text for term in ["spicy", "chili", "heat"]):
        spice_level = "medium"
    elif any(term in text for term in ["mild", "sweet", "comfort"]):
        spice_level = "mild"
    else:
        spice_level = ""

    cuisine = []
    if any(term in text for term in ["ramen", "miso", "japanese", "rice bowl", "sushi"]):
        cuisine.append("japanese")
    if any(term in text for term in ["kimchi", "gochujang", "korean", "shin"]):
        cuisine.append("korean")
    if any(term in text for term in ["curry", "masala", "indian"]):
        cuisine.append("indian")
    if any(term in text for term in ["cafe", "coffee", "latte", "cold brew"]):
        cuisine.append("cafe")

    use_case = []
    if any(term in text for term in ["quick", "instant", "easy", "grab-and-go"]):
        use_case.append("quick meal")
    if any(term in text for term in ["shareable", "snack", "bites"]):
        use_case.append("snacking")
    if any(term in text for term in ["dessert", "sweet"]):
        use_case.append("dessert")
    if any(term in text for term in ["drink", "coffee", "brew"]):
        use_case.append("drinks")
    if any(term in text for term in ["broth", "ramen", "rice", "bowl"]):
        use_case.append("main meal")

    return {
        "dietary": dietary,
        "spice_level": spice_level,
        "cuisine": cuisine,
        "use_case": use_case,
    }


def _build_assistant_catalog(products: list[dict], limit: int = 36) -> list[dict]:
    catalog = []
    for product in products[:limit]:
        facets = _infer_assistant_facets(product)
        catalog.append(
            {
                "title": product["title"],
                "handle": product["handle"],
                "description": product["description"],
                "category": product["product_type"] or "Featured",
                "tags": product["tags"],
                "price": product["price_display"],
                "price_amount": product["price_value"],
                "image": product["featured_image"],
                "variant_id": product["variant_id"],
                "available": product["available"],
                "dietary": facets["dietary"],
                "spice_level": facets["spice_level"],
                "cuisine": facets["cuisine"],
                "use_case": facets["use_case"],
                "nutrition": None,
            }
        )
    return catalog


def _build_home_context() -> dict:
    products, error = _fetch_store_products(12)
    featured_products = products[:4]
    company_details = _get_company_details()
    product_points = [
        "Ready-to-cook ramen and noodle staples",
        "Rice bowls, comfort meals, and savory snacks",
        "Cafe drinks, sweet pours, and quick add-ons",
        "Rotating featured dishes and pantry favorites",
    ]
    categories = []
    seen_categories = set()
    rotating_products = []
    used_handles = set()

    def append_home_product(product: dict) -> bool:
        product_key = product.get("handle") or product.get("id") or product.get("title")
        if product_key in used_handles:
            return False

        used_handles.add(product_key)
        product_type = product["product_type"] or "Featured"
        rotating_products.append(
            {
                "category": product_type or "Featured",
                "title": product["title"],
                "price": product["price_display"],
                "price_amount": product["price_amount"],
                "image": product["featured_image"],
                "description": product["description"] or f"Featured from {product_type or 'the storefront'}.",
                "labels": (product["tags"][:3] if product["tags"] else [product_type or "Featured"])[:3],
                "variant_id": product["variant_id"],
                "handle": product["handle"],
            }
        )
        return True

    for product in products:
        product_type = product["product_type"] or "Featured"
        if product_type not in seen_categories:
            seen_categories.add(product_type)
            if len(categories) < 3:
                categories.append(product_type)

            append_home_product(product)

        if len(rotating_products) >= 8:
            break

    if len(rotating_products) < 8:
        for product in products:
            append_home_product(product)
            if len(rotating_products) >= 8:
                break

    if len(rotating_products) < 4:
        for product in FALLBACK_PRODUCTS:
            append_home_product(product)
            if len(rotating_products) >= 4:
                break

    if len(categories) < 3:
        for item in rotating_products:
            category = item["category"] or "Featured"
            if category not in categories:
                categories.append(category)
            if len(categories) == 3:
                break

    return {
        "products": products,
        "featured_products": featured_products,
        "featured_left": featured_products[:2],
        "featured_right": featured_products[2:4],
        "home_categories": categories,
        "home_rotating_products": rotating_products,
        "assistant_catalog": _build_assistant_catalog(products),
        "about_company": company_details,
        "about_product_points": product_points,
        "shopify_error": error,
    }


def _build_about_context() -> dict:
    products, error = _fetch_store_products(12)
    categories = _build_category_payload(products, limit=4)
    company_details = _get_company_details()

    return {
        "products": products,
        "about_featured_products": products[:3],
        "about_categories": categories[:4],
        "about_company": company_details,
        "about_product_points": [
            "Ready-to-cook ramen and noodle staples",
            "Rice bowls, comfort meals, and savory snacks",
            "Cafe drinks, sweet pours, and quick add-ons",
            "Rotating featured dishes and pantry favorites",
        ],
        "assistant_catalog": _build_assistant_catalog(products),
        "shopify_error": error,
    }


def base(request):
    return render(request, "store/base.html")


def home(request):
    return render(request, "store/home.html", _build_home_context())


def about(request):
    return render(request, "store/about.html", _build_about_context())


def cart(request):
    products, _error = _fetch_store_products(24)
    return render(request, "store/cart.html", {"assistant_catalog": _build_assistant_catalog(products)})


def shop(request):
    products, error = _fetch_store_products(36)
    categories = _build_category_payload(products)

    context = {
        "products": products,
        "shop_categories": categories,
        "featured_shop_product": products[0] if products else None,
        "assistant_catalog": _build_assistant_catalog(products),
        "shopify_error": error,
    }
    return render(request, "store/shop.html", context)


@csrf_exempt
@require_POST
def create_checkout(request):
    if not shopify_is_configured():
        return JsonResponse(
            {"ok": False, "error": "Shopify Storefront API is not configured."},
            status=503,
        )

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "Invalid checkout payload."}, status=400)

    items = payload.get("items") or []
    lines = []
    for item in items:
        variant_id = item.get("variantId") or item.get("variant_id")
        quantity = int(item.get("quantity", 0) or 0)
        if variant_id and quantity > 0:
            lines.append({"merchandiseId": variant_id, "quantity": quantity})

    if not lines:
        return JsonResponse({"ok": False, "error": "Cart is empty or missing Shopify variants."}, status=400)

    try:
        data = shopify_graphql(CART_CREATE, {"lines": lines})
    except Exception as error:  # noqa: BLE001
        return JsonResponse({"ok": False, "error": f"Shopify checkout failed: {error}"}, status=502)

    payload = data["cartCreate"]
    errors = payload.get("userErrors") or []
    if errors:
        return JsonResponse({"ok": False, "error": errors[0]["message"]}, status=400)

    return JsonResponse(
        {
            "ok": True,
            "checkoutUrl": payload["cart"]["checkoutUrl"],
        }
    )
