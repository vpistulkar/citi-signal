const CART_FALLBACK_STORAGE_KEY = 'project_cart_fallback';

export function getEmptyCart() {
  return {
    productCount: 0,
    products: {},
    subTotal: 0,
    total: 0,
  };
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function toPositiveInteger(value, fallback = 1) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

function toNonNegativeNumber(value, fallback = 0) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return fallback;
  return n;
}

function normalizeProduct(product, key = '') {
  const id = String(product?.id || key || '').trim();
  if (!id) return null;
  const quantity = toPositiveInteger(product?.quantity, 1);
  const price = toNonNegativeNumber(product?.price, 0);
  const subTotal = toNonNegativeNumber(product?.subTotal, price * quantity);
  return {
    id,
    sku: String(product?.sku || id).trim() || id,
    name: product?.name || '',
    image: product?.image || '',
    thumbnail: product?.thumbnail || '',
    category: product?.category || '',
    description: product?.description || '',
    quantity,
    price,
    subTotal,
    total: toNonNegativeNumber(product?.total, subTotal),
  };
}

export function normalizeCart(cart) {
  const base = getEmptyCart();
  if (!isObject(cart)) return base;

  const inputProducts = isObject(cart.products) ? cart.products : {};
  const products = {};
  Object.entries(inputProducts).forEach(([key, value]) => {
    const normalized = normalizeProduct(value, key);
    if (normalized) products[normalized.id] = normalized;
  });

  const productValues = Object.values(products);
  const productCount = productValues.reduce((sum, p) => sum + p.quantity, 0);
  const subTotal = productValues.reduce((sum, p) => sum + p.subTotal, 0);

  return {
    ...base,
    ...cart,
    products,
    productCount,
    subTotal,
    total: subTotal,
  };
}

function hasProducts(cart) {
  return Boolean(cart && isObject(cart.products) && Object.keys(cart.products).length > 0);
}

function readFallbackCart() {
  try {
    if (typeof localStorage === 'undefined') return getEmptyCart();
    const raw = localStorage.getItem(CART_FALLBACK_STORAGE_KEY);
    if (!raw) return getEmptyCart();
    return normalizeCart(JSON.parse(raw));
  } catch {
    return getEmptyCart();
  }
}

export function syncFallbackCart(cart) {
  const normalized = normalizeCart(cart);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CART_FALLBACK_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // ignore storage errors
  }
  return normalized;
}

function readDataLayerCart() {
  if (typeof window === 'undefined' || typeof window.getDataLayerProperty !== 'function') {
    return null;
  }
  const dataLayerCart = window.getDataLayerProperty('cart');
  return normalizeCart(dataLayerCart);
}

export function getCartSnapshot() {
  const dataLayerCart = readDataLayerCart();
  const fallbackCart = readFallbackCart();
  if (hasProducts(dataLayerCart)) return dataLayerCart;
  if (hasProducts(fallbackCart)) return fallbackCart;
  return dataLayerCart || fallbackCart || getEmptyCart();
}

export function saveCartSnapshot(cart) {
  const normalized = syncFallbackCart(cart);
  const canUpdateDataLayer = typeof window !== 'undefined'
    && typeof window.updateDataLayer === 'function'
    && Boolean(window._dataLayerReady);

  if (canUpdateDataLayer) {
    window.updateDataLayer({ cart: normalized }, false);
  }

  return normalized;
}

export function addProductToCart(productData) {
  const normalizedProduct = normalizeProduct(productData);
  if (!normalizedProduct) return false;

  const currentCart = getCartSnapshot();
  const nextCart = normalizeCart(currentCart);
  const existing = nextCart.products[normalizedProduct.id];

  if (existing) {
    existing.quantity += normalizedProduct.quantity;
    existing.subTotal = existing.quantity * existing.price;
    existing.total = existing.subTotal;
  } else {
    nextCart.products[normalizedProduct.id] = {
      ...normalizedProduct,
      subTotal: normalizedProduct.price * normalizedProduct.quantity,
      total: normalizedProduct.price * normalizedProduct.quantity,
    };
  }

  saveCartSnapshot(nextCart);
  return true;
}

export function removeProductFromCart(cart, productId) {
  const nextCart = normalizeCart(cart);
  delete nextCart.products[productId];
  return normalizeCart(nextCart);
}

export function setCartItemQuantity(cart, productId, quantity) {
  const nextCart = normalizeCart(cart);
  if (!nextCart.products[productId]) return nextCart;

  const safeQty = toPositiveInteger(quantity, 1);
  nextCart.products[productId].quantity = safeQty;
  nextCart.products[productId].subTotal = safeQty * nextCart.products[productId].price;
  nextCart.products[productId].total = nextCart.products[productId].subTotal;
  return normalizeCart(nextCart);
}
