#!/usr/bin/env node
require('dotenv').config();
const watchlist = require('./watchlist');
const { start } = require('./scheduler');

const [,, command, ...args] = process.argv;

function showHelp() {
  console.log(`
Availify - Real-time inventory tracker for Walmart, Target, and Costco

Usage:
  availify watch                      Start the inventory watcher
  availify add <store> <query>        Add item to watchlist
  availify remove <id>                Remove item from watchlist
  availify list                       List all watched items

Stores: walmart, target, costco

Examples:
  availify add walmart "PS5 console"
  availify add target "Nintendo Switch"
  availify add costco "paper towels"
  availify remove 1234567890
  availify list
  availify watch
`);
}

switch (command) {
  case 'watch':
    start();
    break;

  case 'add': {
    const [store, ...queryParts] = args;
    const query = queryParts.join(' ');
    if (!store || !query) {
      console.error('Usage: availify add <store> <query>');
      process.exit(1);
    }
    try {
      const item = watchlist.add(store, query);
      console.log(`✅ Added to watchlist: "${item.query}" at ${item.store} (id: ${item.id})`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
    break;
  }

  case 'remove': {
    const [id] = args;
    if (!id) {
      console.error('Usage: availify remove <id>');
      process.exit(1);
    }
    try {
      const item = watchlist.remove(id);
      console.log(`🗑️  Removed from watchlist: "${item.query}" at ${item.store}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
    break;
  }

  case 'list': {
    const items = watchlist.list();
    if (items.length === 0) {
      console.log('Your watchlist is empty. Use `availify add <store> <query>` to add items.');
    } else {
      console.log(`\nWatchlist (${items.length} items):\n`);
      items.forEach(item => {
        const status = item.lastStatus
          ? (item.lastStatus.available ? '✅ In Stock' : '❌ Out of Stock')
          : '⏳ Not yet checked';
        console.log(`  [${item.id}] ${item.store.toUpperCase()} | "${item.query}" | ${status}`);
        if (item.lastChecked) console.log(`         Last checked: ${item.lastChecked}`);
      });
      console.log();
    }
    break;
  }

  default:
    showHelp();
    break;
}
