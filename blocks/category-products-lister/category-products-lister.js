import { readBlockConfig, createLumaProductImagePicture } from "../../scripts/aem.js";
import { isAuthorEnvironment } from "../../scripts/scripts.js";
import { getEnvironmentValue, getHostname } from "../../scripts/utils.js";

const AUTHOR_PRODUCTS_ENDPOINT = "/graphql/execute.json/luma3/lumaProductListByPath;";
const PUBLISH_GRAPHQL_PROXY_ENDPOINT = "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/luma-fetch";
const PUBLISH_PRODUCTS_ENDPOINT_KEY = "lumaProductListByPath";
let categoryProductsAuthorBasePromise;
let categoryProductsPublishEnvironmentPromise;

async function getCategoryProductsAuthorBase() {
  if (!categoryProductsAuthorBasePromise) {
    categoryProductsAuthorBasePromise = getHostname()
      .then((hostname) => (hostname || window.location.origin || "").replace(/\/$/, ""))
      .catch(() => (window.location.origin || "").replace(/\/$/, ""));
  }
  return categoryProductsAuthorBasePromise;
}

async function getCategoryProductsPublishEnvironment() {
  if (!categoryProductsPublishEnvironmentPromise) {
    categoryProductsPublishEnvironmentPromise = getEnvironmentValue().catch(() => undefined);
  }
  return categoryProductsPublishEnvironmentPromise;
}

function buildCard(item, isAuthor) {
  const { id, sku, name, damImageURL = {}, category = [] } = item || {};
  const productId = sku || id || "";

  const card = document.createElement("article");
  card.className = "cpl-card";

  // Make card clickable and redirect to product page
  if (productId) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const currentPath = window.location.pathname;
      // Replace the last segment (e.g., 'men-products') with 'product'
      const basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));
      // On author add .html extension, on publish don't
      const productPath = isAuthor
        ? `${basePath}/product.html`
        : `${basePath}/product`;
      window.location.href = `${productPath}?productId=${encodeURIComponent(
        productId
      )}`;
    });
  }

  let picture = null;
  if (damImageURL && (damImageURL._dynamicUrl || damImageURL._publishUrl || damImageURL._authorUrl)) {
    picture = createLumaProductImagePicture(damImageURL, name || "Product image", {
      isAuthor,
      eager: false,
    });
  }

  const imgWrap = document.createElement("div");
  imgWrap.className = "cpl-card-media";
  if (picture) imgWrap.append(picture);

  const meta = document.createElement("div");
  meta.className = "cpl-card-meta";
  const categoryText = category && category.length ? category.join(", ") : "";
  const cat = document.createElement("p");
  cat.className = "cpl-card-category";
  // Format category: remove "luma:" or "Lumaproducts:", replace commas with slashes, uppercase
  cat.textContent = categoryText
    .replace(/^(luma:|lumaproducts:)/gi, "") // Remove luma/lumaproducts prefix (case-insensitive)
    .replace(/\//g, " / ") // Replace commas with slashes
    .toUpperCase(); // Convert to uppercase
  const title = document.createElement("h3");
  title.className = "cpl-card-title";
  title.textContent = name || "";
  meta.append(cat, title);

  card.append(imgWrap, meta);
  return card;
}

async function fetchProducts(path) {
  try {
    if (!path) return [];

    const isAuthor = isAuthorEnvironment();
    const authorBase = await getCategoryProductsAuthorBase();
    const environment = await getCategoryProductsPublishEnvironment();
    const url = isAuthor
      ? `${authorBase}${AUTHOR_PRODUCTS_ENDPOINT}_path=${path}`
      : `${PUBLISH_GRAPHQL_PROXY_ENDPOINT}?endpoint=${PUBLISH_PRODUCTS_ENDPOINT_KEY}${environment ? `&environment=${environment}` : ''}&_path=${path}`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    const json = await resp.json();
    return json?.data?.lumaProductsModelList?.items || [];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Category Products Lister: fetch error", e);
    return [];
  }
}

function renderHeader(container, selectedTags) {
  if (!selectedTags || selectedTags.length === 0) return;
  const wrap = document.createElement("div");
  wrap.className = "cpl-tags";
  const list = Array.isArray(selectedTags)
    ? selectedTags
    : `${selectedTags}`.split(",");
  list
    .map((t) => `${t}`.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "cpl-tag";
      chip.textContent = tag;
      wrap.append(chip);
    });
  container.append(wrap);
}

export default async function decorate(block) {
  // Check if we're in author environment
  const isAuthor = isAuthorEnvironment();

  // Extract folder path from Universal Editor authored markup
  let folderHref =
    block.querySelector("a[href]")?.href ||
    block.querySelector("a[href]")?.textContent?.trim() ||
    "";

  // Also try readBlockConfig as fallback for document-based authoring
  const cfg = readBlockConfig(block);
  if (!folderHref) {
    folderHref = cfg?.folder || cfg?.reference || cfg?.path || "";
  }

  // Normalize folder path to pathname if an absolute URL is provided
  try {
    if (folderHref && folderHref.startsWith("http")) {
      const u = new URL(folderHref);
      folderHref = u.pathname;
    }
  } catch (e) {
    /* ignore */
  }

  // Remove .html extension if present (Universal Editor adds it)
  if (folderHref && folderHref.endsWith(".html")) {
    folderHref = folderHref.replace(/\.html$/, "");
  }

  // Extract tags - for Universal Editor they'll be in data attributes
  const tags = block.dataset?.["cqTags"] || cfg?.tags || cfg?.["cq:tags"] || "";

  // Clear author table
  block.innerHTML = "";

  renderHeader(block, tags);

  const grid = document.createElement("div");
  grid.className = "cpl-grid";
  block.append(grid);

  const items = await fetchProducts(folderHref);
  if (!items || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cpl-empty";
    empty.textContent = "No products found.";
    grid.append(empty);
    return;
  }

  const cards = items.map((item) => buildCard(item, isAuthor));
  grid.append(...cards);
}
