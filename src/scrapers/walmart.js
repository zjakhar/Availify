const axios = require('axios');
const cheerio = require('cheerio');

const WALMART_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

async function scrapeUrl(url) {
  try {
    const response = await axios.get(url, { headers: WALMART_HEADERS });
    const html = response.data || '';
    // Try __NEXT_DATA__ (Walmart's Next.js SSR payload)
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (m) {
      const nextData = JSON.parse(m[1]);
      const prod = nextData?.props?.pageProps?.initialData?.data?.product;
      if (prod) {
        return {
          name: prod.name || null,
          price: prod.priceInfo?.currentPrice?.price != null ? `$${prod.priceInfo.currentPrice.price}` : null,
          inStock: prod.availabilityStatus === 'IN_STOCK',
          image: prod.imageInfo?.thumbnailUrl || null,
          url,
        };
      }
    }
    // Try JSON-LD
    const $ = cheerio.load(html);
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
    return { name: null, price: null, inStock: null, image: null, url };
  } catch (err) {
    return { name: null, price: null, inStock: null, image: null, url, error: err.message };
  }
}

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
      const itemUrl = link.startsWith('http') ? link : `https://www.walmart.com${link}`;
      if (name) products.push({ name, price, url: itemUrl, inStock: true });
    });
    return { available: products.length > 0, products };
  } catch (err) {
    return { available: false, products: [], error: err.message };
  }
}

module.exports = { check, scrapeUrl };
