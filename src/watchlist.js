const fs = require('fs');
const path = require('path');
require('dotenv').config();

const WATCHLIST_PATH = process.env.WATCHLIST_PATH || path.join(process.cwd(), 'watchlist.json');

function load() {
  if (!fs.existsSync(WATCHLIST_PATH)) return [];
  return JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
}

function save(items) {
  fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(items, null, 2));
}

function add(store, query) {
  const items = load();
  const store_normalized = store.toLowerCase();
  const valid_stores = ['walmart', 'target', 'costco'];
  if (!valid_stores.includes(store_normalized)) {
    throw new Error(`Invalid store "${store}". Valid stores: ${valid_stores.join(', ')}`);
  }
  const exists = items.find(i => i.store === store_normalized && i.query === query);
  if (exists) throw new Error(`Already watching "${query}" at ${store}`);
  const item = { id: Date.now().toString(), store: store_normalized, query, addedAt: new Date().toISOString(), lastStatus: null };
  items.push(item);
  save(items);
  return item;
}

function remove(id) {
  const items = load();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) throw new Error(`Item with id "${id}" not found`);
  const [removed] = items.splice(idx, 1);
  save(items);
  return removed;
}

function list() {
  return load();
}

function updateStatus(id, status) {
  const items = load();
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.lastStatus = status;
  item.lastChecked = new Date().toISOString();
  save(items);
}

module.exports = { add, remove, list, updateStatus };
