const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp file for the watchlist
const tmpPath = path.join(os.tmpdir(), `watchlist-test-${Date.now()}.json`);
process.env.WATCHLIST_PATH = tmpPath;
process.env.DOTENV_CONFIG_PATH = '/dev/null';

const watchlist = require('../src/watchlist');

afterAll(() => {
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
});

beforeEach(() => {
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
});

test('list returns empty array when no watchlist file', () => {
  expect(watchlist.list()).toEqual([]);
});

test('add creates a watchlist item', () => {
  const item = watchlist.add('walmart', 'PS5 console');
  expect(item.store).toBe('walmart');
  expect(item.query).toBe('PS5 console');
  expect(item.id).toBeDefined();
});

test('add throws for invalid store', () => {
  expect(() => watchlist.add('amazon', 'PS5')).toThrow('Invalid store');
});

test('add throws for duplicate item', () => {
  watchlist.add('walmart', 'PS5');
  expect(() => watchlist.add('walmart', 'PS5')).toThrow('Already watching');
});

test('list returns added items', () => {
  watchlist.add('walmart', 'PS5');
  watchlist.add('target', 'Switch');
  expect(watchlist.list()).toHaveLength(2);
});

test('remove deletes an item by id', () => {
  const item = watchlist.add('costco', 'paper towels');
  watchlist.remove(item.id);
  expect(watchlist.list()).toHaveLength(0);
});

test('remove throws for unknown id', () => {
  expect(() => watchlist.remove('nonexistent')).toThrow('not found');
});

test('updateStatus updates item status', () => {
  const item = watchlist.add('walmart', 'Switch');
  watchlist.updateStatus(item.id, { available: true, products: [] });
  const items = watchlist.list();
  expect(items[0].lastStatus).toEqual({ available: true, products: [] });
});
