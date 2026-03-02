const axios = require('axios');

const TARGET_API_KEY = '9f36aeafbe60771e321a7cc95a78140772ab3e96';
const TARGET_PRICING_STORE_ID = '1148';
const TARGET_VISITOR_ID = '018a4f66-7697-4a8b-b982-55de86a92c59';
const TARGET_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

async function scrapeUrl(url) {
  try {
    // Extract TCIN from Target URL: /p/.../-/A-{tcin}
    const tcinMatch = url.match(/\/A-(\d+)/);
    const tcin = tcinMatch ? tcinMatch[1] : null;
    if (!tcin) {
      return { name: null, price: null, inStock: null, image: null, url, error: 'Could not extract TCIN from URL' };
    }
    const pdpUrl = `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=${TARGET_API_KEY}&tcin=${encodeURIComponent(tcin)}&pricing_store_id=${TARGET_PRICING_STORE_ID}&visitor_id=${TARGET_VISITOR_ID}&channel=WEB&page=%2Fp%2FA-${encodeURIComponent(tcin)}`;
    const response = await axios.get(pdpUrl, { headers: TARGET_HEADERS });
    const product = response.data?.data?.product;
    if (product) {
      const desc = product.item?.product_description || {};
      const price = product.price || {};
      const avail = product.availability || {};
      const images = product.item?.enrichment?.images || {};
      return {
        name: desc.title || null,
        price: price.current_retail != null ? `$${Number(price.current_retail).toFixed(2)}` : null,
        inStock: avail.availability_status === 'IN_STOCK' || avail.availability_status === 'AVAILABLE',
        image: images.primary_image_url || null,
        url,
      };
    }
    return { name: null, price: null, inStock: null, image: null, url };
  } catch (err) {
    return { name: null, price: null, inStock: null, image: null, url, error: err.message };
  }
}

async function check(query) {
  try {
    const url = `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=${TARGET_API_KEY}&keyword=${encodeURIComponent(query)}&count=10&offset=0&channel=WEB&country=US&locale=en-US`;
    const response = await axios.get(url, { headers: TARGET_HEADERS });
    const searchProducts = response.data && response.data.data && response.data.data.search && response.data.data.search.products;
    if (!searchProducts || searchProducts.length === 0) {
      return { available: false, products: [] };
    }
    const products = searchProducts.map(p => {
      const item = p.item || {};
      const desc = item.product_description || {};
      const price = item.price || {};
      const tcin = item.tcin || '';
      return {
        name: desc.title || '',
        price: price.current_retail || '',
        url: tcin ? `https://www.target.com/p/-/A-${tcin}` : '',
        inStock: item.availability_status === 'IN_STOCK' || item.availability_status === 'AVAILABLE',
      };
    });
    const available = products.some(p => p.inStock);
    return { available, products };
  } catch (err) {
    return { available: false, products: [], error: err.message };
  }
}

module.exports = { check, scrapeUrl };
