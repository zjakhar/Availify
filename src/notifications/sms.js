async function send(item, result) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.TWILIO_TO_NUMBER;
  if (!sid || !token || !from || !to) return;
  const twilio = require('twilio')(sid, token);
  const status = result.available ? 'IN STOCK' : 'Out of Stock';
  const body = `Availify Alert: ${item.query} at ${item.store} is ${status}`;
  await twilio.messages.create({ body, from, to });
}

module.exports = { send };
