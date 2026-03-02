const axios = require('axios');
const cheerio = require('cheerio');

async function check(query) {
  try {
    const url = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    const $ = cheerio.load(response.data);
    const products = [];
    $('[data-item-id]').each((i, el) => {
      const name = $(el).find('[data-automation-id="product-title"]').text().trim();
      const price = $(el).find('[itemprop="price"]').attr('content') || '';
      const link = $(el).find('a').attr('href') || '';
      const url = link.startsWith('http') ? link : `https://www.walmart.com${link}`;
      if (name) products.push({ name, price, url, inStock: true });
    });
    return { available: products.length > 0, products };
  } catch (err) {
    return { available: false, products: [], error: err.message };
  }
}

module.exports = { check };
