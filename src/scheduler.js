const cron = require('node-cron');
require('dotenv').config();
const { list, updateStatus } = require('./watchlist');
const { checkAvailability } = require('./scrapers');
const { sendNotification } = require('./notifications');

const DEFAULT_INTERVAL = '*/5 * * * *';

async function checkAll() {
  const items = list();
  console.log(`[${new Date().toISOString()}] Checking ${items.length} watched items...`);
  for (const item of items) {
    try {
      const result = await checkAvailability(item.store, item.query);
      const wasAvailable = item.lastStatus && item.lastStatus.available;
      const isAvailable = result.available;
      // Only notify on status change (became available)
      if (isAvailable && !wasAvailable) {
        console.log(`  ✅ ALERT: "${item.query}" at ${item.store} is now IN STOCK!`);
        await sendNotification(item, result);
      } else {
        console.log(`  ${isAvailable ? '✅' : '❌'} "${item.query}" at ${item.store}: ${isAvailable ? 'In Stock' : 'Out of Stock'}`);
      }
      updateStatus(item.id, result);
    } catch (err) {
      console.error(`  ⚠️  Error checking "${item.query}" at ${item.store}: ${err.message}`);
    }
  }
}

function start() {
  const interval = process.env.CHECK_INTERVAL || DEFAULT_INTERVAL;
  console.log(`Starting Availify scheduler with interval: ${interval}`);
  checkAll(); // run immediately on start
  cron.schedule(interval, checkAll);
}

module.exports = { start, checkAll };
