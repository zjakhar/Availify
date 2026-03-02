const axios = require('axios');

async function send(item, result) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const status = result.available ? '✅ IN STOCK' : '❌ Out of Stock';
  const content = `**Availify Alert** | ${status}\n**Store:** ${item.store}\n**Query:** ${item.query}`;
  await axios.post(url, { content });
}

module.exports = { send };
