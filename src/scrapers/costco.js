const axios = require('axios');
const cheerio = require('cheerio');

const COSTCO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

async function scrapeUrl(url) {
  try {
    const response = await axios.get(url, { headers: COSTCO_HEADERS });
    const html = response.data || '';
    const $ = cheerio.load(html);
    // Try JSON-LD
    const ldScript = $('script[type="application/ld+json"]').first().html();
    if (ldScript) {
      const ld = JSON.parse(ldScript);
      const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
      return {
        name: ld.name || null,
        price: offer?.price != null ? `$${offer.price}` : null,
        inStock: (offer?.availability || '').includes('InStock'),
        image: Array.isArray(ld.image) ? ld.image[0] : (ld.image || null),
        url,
      };
    }
    // Fallback: HTML parsing
    const name = $('h1').first().text().trim() || null;
    const priceText = $('.value').first().text().trim() || null;
    const img = $('.product-img img, .cloudzoom img').first().attr('src') || null;
    return { name, price: priceText, inStock: null, image: img, url };
  } catch (err) {
    return { name: null, price: null, inStock: null, image: null, url, error: err.message };
  }
}

async function check(query) {
  try {
    const url = `https://www.costco.com/CatalogSearch?storeId=10301&langId=-1&keyword=${encodeURIComponent(query)}&refine=ads_f33503_ntk_cs%3A%22Online%22`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    const $ = cheerio.load(response.data);
    const products = [];
    $('.product-list-item').each((i, el) => {
      const name = $(el).find('.description').text().trim();
      const price = $(el).find('.price').text().trim();
      const link = $(el).find('a').attr('href') || '';
      const itemUrl = link.startsWith('http') ? link : `https://www.costco.com${link}`;
      if (name) products.push({ name, price, url: itemUrl, inStock: true });
    });
    // Fallback: look for automation-product-number elements
    if (products.length === 0) {
      $('.automation-product-number').each((i, el) => {
        products.push({ name: $(el).text().trim(), price: '', url: '', inStock: true });
      });
    }
    return { available: products.length > 0, products };
  } catch (err) {
    return { available: false, products: [], error: err.message };
  }
}

module.exports = { check, scrapeUrl };
