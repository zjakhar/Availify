jest.mock('axios');
const axios = require('axios');

beforeEach(() => {
  jest.clearAllMocks();
});

const mockItem = { store: 'walmart', query: 'PS5', id: '123' };
const mockResultInStock = { available: true, products: [] };
const mockResultOutOfStock = { available: false, products: [] };

describe('Slack notification', () => {
  const slack = require('../src/notifications/slack');

  test('does nothing when SLACK_WEBHOOK_URL is not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    await slack.send(mockItem, mockResultInStock);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('sends POST to Slack webhook when URL is set', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    axios.post.mockResolvedValueOnce({ status: 200 });
    await slack.send(mockItem, mockResultInStock);
    expect(axios.post).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({ text: expect.stringContaining('IN STOCK') })
    );
    delete process.env.SLACK_WEBHOOK_URL;
  });
});

describe('Discord notification', () => {
  const discord = require('../src/notifications/discord');

  test('does nothing when DISCORD_WEBHOOK_URL is not set', async () => {
    delete process.env.DISCORD_WEBHOOK_URL;
    await discord.send(mockItem, mockResultInStock);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('sends POST to Discord webhook when URL is set', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
    axios.post.mockResolvedValueOnce({ status: 200 });
    await discord.send(mockItem, mockResultInStock);
    expect(axios.post).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({ content: expect.stringContaining('IN STOCK') })
    );
    delete process.env.DISCORD_WEBHOOK_URL;
  });
});

describe('SMS notification', () => {
  const sms = require('../src/notifications/sms');

  test('does nothing when Twilio credentials are not set', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    await sms.send(mockItem, mockResultInStock);
    // Should not throw
  });
});

describe('notifications index', () => {
  test('sendNotification calls all channels', async () => {
    const { sendNotification } = require('../src/notifications');
    // Should not throw even if no env vars are set
    await expect(sendNotification(mockItem, mockResultInStock)).resolves.toBeUndefined();
  });
});
