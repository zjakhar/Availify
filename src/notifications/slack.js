const axios = require('axios');

async function send(item, result) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  const status = result.available ? '✅ IN STOCK' : '❌ Out of Stock';
  const text = `*Availify Alert* | ${status}\n*Store:* ${item.store}\n*Query:* ${item.query}`;
  await axios.post(url, { text });
}

module.exports = { send };
