const axios = require('axios');

async function check(query) {
  try {
    const url = `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&keyword=${encodeURIComponent(query)}&count=10&offset=0&channel=WEB&country=US&locale=en-US`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
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

module.exports = { check };
