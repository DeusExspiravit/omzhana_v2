import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from django.conf import settings


def shopify_is_configured() -> bool:
    return bool(settings.SHOPIFY_STORE_DOMAIN and settings.SHOPIFY_STOREFRONT_TOKEN)


def _graphql_url() -> str:
    domain = settings.SHOPIFY_STORE_DOMAIN.strip()
    if domain.startswith("http://") or domain.startswith("https://"):
        domain = urlparse(domain).netloc

    domain = domain.split("/", 1)[0].strip()

    if not domain or domain == "admin.shopify.com":
        raise RuntimeError(
            "SHOPIFY_STORE_DOMAIN must be your storefront domain, for example "
            "'your-store.myshopify.com', not a Shopify Admin URL."
        )

    return (
        f"https://{domain}/api/"
        f"{settings.SHOPIFY_API_VERSION}/graphql.json"
    )


def shopify_graphql(query: str, variables: dict | None = None) -> dict:
    if not shopify_is_configured():
        raise RuntimeError("Shopify Storefront API is not configured.")

    request = Request(
        _graphql_url(),
        data=json.dumps({"query": query, "variables": variables or {}}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": settings.SHOPIFY_STOREFRONT_TOKEN,
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(f"Shopify request failed with HTTP {error.code}.") from error
    except URLError as error:
        raise RuntimeError(f"Shopify request failed: {error.reason}") from error

    if payload.get("errors"):
        raise RuntimeError(payload["errors"])

    data = payload.get("data") or {}
    if not data:
        raise RuntimeError("Shopify returned an empty response.")

    return data
