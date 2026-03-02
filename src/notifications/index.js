const slack = require('./slack');
const discord = require('./discord');
const sms = require('./sms');

async function sendNotification(item, result) {
  await Promise.allSettled([
    slack.send(item, result),
    discord.send(item, result),
    sms.send(item, result),
  ]);
}

module.exports = { sendNotification };
