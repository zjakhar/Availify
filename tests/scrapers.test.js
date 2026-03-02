jest.mock('axios');
const axios = require('axios');

// Reset module registry between tests to get fresh modules
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Walmart scraper', () => {
  const walmart = require('../src/scrapers/walmart');

  test('returns available:false on error', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    const result = await walmart.check('PS5');
    expect(result.available).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('returns available:false when no products found', async () => {
    axios.get.mockResolvedValueOnce({ data: '<html><body></body></html>' });
    const result = await walmart.check('xyznotaproduct12345');
    expect(result.available).toBe(false);
  });

  test('scrapeUrl returns product info from __NEXT_DATA__', async () => {
    const nextData = {
      props: {
        pageProps: {
          initialData: {
            data: {
              product: {
                name: 'Pokémon Booster Bundle',
                priceInfo: { currentPrice: { price: 19.99 } },
                availabilityStatus: 'IN_STOCK',
                imageInfo: { thumbnailUrl: 'https://example.com/img.jpg' },
              },
            },
          },
        },
      },
    };
    const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
    axios.get.mockResolvedValueOnce({ data: html });
    const url = 'https://www.walmart.com/ip/Pokemon-Booster-Bundle/15042474261';
    const result = await walmart.scrapeUrl(url);
    expect(result.name).toBe('Pokémon Booster Bundle');
    expect(result.price).toBe('$19.99');
    expect(result.inStock).toBe(true);
    expect(result.image).toBe('https://example.com/img.jpg');
    expect(result.url).toBe(url);
  });

  test('scrapeUrl falls back to JSON-LD when __NEXT_DATA__ absent', async () => {
    const ld = {
      name: 'Pokémon Elite Trainer Box',
      offers: { price: 49.99, availability: 'https://schema.org/InStock' },
      image: 'https://example.com/etb.jpg',
    };
    const html = `<html><body><script type="application/ld+json">${JSON.stringify(ld)}</script></body></html>`;
    axios.get.mockResolvedValueOnce({ data: html });
    const url = 'https://www.walmart.com/ip/Pokemon-ETB/18710966734';
    const result = await walmart.scrapeUrl(url);
    expect(result.name).toBe('Pokémon Elite Trainer Box');
    expect(result.price).toBe('$49.99');
    expect(result.inStock).toBe(true);
    expect(result.url).toBe(url);
  });

  test('scrapeUrl returns error info on network failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    const url = 'https://www.walmart.com/ip/SomeProduct/12345';
    const result = await walmart.scrapeUrl(url);
    expect(result.name).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.url).toBe(url);
  });
});

describe('Target scraper', () => {
  const target = require('../src/scrapers/target');

  test('returns available:false on error', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    const result = await target.check('PS5');
    expect(result.available).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('returns available:true when in-stock products found', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: {
          search: {
            products: [
              { item: { tcin: '123', product_description: { title: 'PS5' }, price: { current_retail: 499.99 }, availability_status: 'IN_STOCK' } }
            ]
          }
        }
      }
    });
    const result = await target.check('PS5');
    expect(result.available).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
  });

  test('returns available:false when products are out of stock', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: {
          search: {
            products: [
              { item: { tcin: '123', product_description: { title: 'PS5' }, price: { current_retail: 499.99 }, availability_status: 'OUT_OF_STOCK' } }
            ]
          }
        }
      }
    });
    const result = await target.check('PS5');
    expect(result.available).toBe(false);
  });

  test('scrapeUrl returns product info from Target PDP API', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: {
          product: {
            item: {
              product_description: { title: 'Pokémon Destined Rivals Booster Bundle' },
              enrichment: { images: { primary_image_url: 'https://target.scene7.com/is/image/Target/94300067' } },
            },
            price: { current_retail: 24.99 },
            availability: { availability_status: 'IN_STOCK' },
          },
        },
      },
    });
    const url = 'https://www.target.com/p/pokemon-trading-card-game/-/A-94300067';
    const result = await target.scrapeUrl(url);
    expect(result.name).toBe('Pokémon Destined Rivals Booster Bundle');
    expect(result.price).toBe('$24.99');
    expect(result.inStock).toBe(true);
    expect(result.image).toBe('https://target.scene7.com/is/image/Target/94300067');
    expect(result.url).toBe(url);
  });

  test('scrapeUrl returns error when TCIN cannot be extracted', async () => {
    const url = 'https://www.target.com/p/no-tcin-here';
    const result = await target.scrapeUrl(url);
    expect(result.error).toBeDefined();
    expect(result.name).toBeNull();
    expect(result.url).toBe(url);
  });

  test('scrapeUrl returns error info on network failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    const url = 'https://www.target.com/p/pokemon/-/A-94300067';
    const result = await target.scrapeUrl(url);
    expect(result.name).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.url).toBe(url);
  });
});

describe('Costco scraper', () => {
  const costco = require('../src/scrapers/costco');

  test('returns available:false on error', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    const result = await costco.check('paper towels');
    expect(result.available).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('returns available:false when no products found', async () => {
    axios.get.mockResolvedValueOnce({ data: '<html><body></body></html>' });
    const result = await costco.check('xyznotaproduct12345');
    expect(result.available).toBe(false);
  });

  test('scrapeUrl returns product info from JSON-LD', async () => {
    const ld = {
      name: 'Pokémon 3-Pack Stacking Tins',
      offers: { price: 39.99, availability: 'https://schema.org/InStock' },
      image: 'https://example.com/tins.jpg',
    };
    const html = `<html><body><script type="application/ld+json">${JSON.stringify(ld)}</script></body></html>`;
    axios.get.mockResolvedValueOnce({ data: html });
    const url = 'https://www.costco.com/pokemon-3-pack-stacking-tins.product.4000114207.html';
    const result = await costco.scrapeUrl(url);
    expect(result.name).toBe('Pokémon 3-Pack Stacking Tins');
    expect(result.price).toBe('$39.99');
    expect(result.inStock).toBe(true);
    expect(result.image).toBe('https://example.com/tins.jpg');
    expect(result.url).toBe(url);
  });

  test('scrapeUrl falls back to HTML parsing when no JSON-LD', async () => {
    const html = '<html><body><h1>Pokémon Tins</h1><span class="value">$34.99</span></body></html>';
    axios.get.mockResolvedValueOnce({ data: html });
    const url = 'https://www.costco.com/pokemon-tins.product.4000114207.html';
    const result = await costco.scrapeUrl(url);
    expect(result.name).toBe('Pokémon Tins');
    expect(result.price).toBe('$34.99');
    expect(result.url).toBe(url);
  });

  test('scrapeUrl returns error info on network failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    const url = 'https://www.costco.com/pokemon-tins.product.4000114207.html';
    const result = await costco.scrapeUrl(url);
    expect(result.name).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.url).toBe(url);
  });
});

describe('scrapers index', () => {
  const { checkAvailability, scrapeByUrl } = require('../src/scrapers');

  test('throws for unknown store', async () => {
    await expect(checkAvailability('amazon', 'PS5')).rejects.toThrow('Unknown store');
  });

  test('scrapeByUrl throws for unsupported URL', async () => {
    await expect(scrapeByUrl('https://www.amazon.com/dp/B09XYZ')).rejects.toThrow('Unsupported store URL');
  });

  test('scrapeByUrl routes walmart.com URLs to walmart scraper', async () => {
    axios.get.mockResolvedValueOnce({ data: '<html></html>' });
    const result = await scrapeByUrl('https://www.walmart.com/ip/SomeProduct/15042474261');
    expect(result).toBeDefined();
    expect(result.url).toBe('https://www.walmart.com/ip/SomeProduct/15042474261');
  });

  test('scrapeByUrl routes target.com URLs to target scraper', async () => {
    const url = 'https://www.target.com/p/pokemon/-/A-94300067';
    axios.get.mockResolvedValueOnce({
      data: { data: { product: null } },
    });
    const result = await scrapeByUrl(url);
    expect(result).toBeDefined();
    expect(result.url).toBe(url);
  });

  test('scrapeByUrl routes costco.com URLs to costco scraper', async () => {
    axios.get.mockResolvedValueOnce({ data: '<html></html>' });
    const result = await scrapeByUrl('https://www.costco.com/pokemon-tins.product.4000114207.html');
    expect(result).toBeDefined();
    expect(result.url).toBe('https://www.costco.com/pokemon-tins.product.4000114207.html');
  });
});
