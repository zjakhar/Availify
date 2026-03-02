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
});

describe('scrapers index', () => {
  const { checkAvailability } = require('../src/scrapers');

  test('throws for unknown store', async () => {
    await expect(checkAvailability('amazon', 'PS5')).rejects.toThrow('Unknown store');
  });
});
