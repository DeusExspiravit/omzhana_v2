PRODUCTS_QUERY = """
query Products($first: Int!) {
  products(first: $first, sortKey: BEST_SELLING) {
    edges {
      node {
        id
        title
        handle
        description
        productType
        tags
        featuredImage {
          url
          altText
        }
        images(first: 10) {
          edges {
            node {
              url
              altText
            }
          }
        }
        variants(first: 25) {
          edges {
            node {
              id
              title
              availableForSale
              price {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
}
"""


CART_CREATE = """
mutation CartCreate($lines: [CartLineInput!]!) {
  cartCreate(input: { lines: $lines }) {
    cart {
      id
      checkoutUrl
    }
    userErrors {
      field
      message
    }
  }
}
"""
