const walmart = require('./walmart');
const target = require('./target');
const costco = require('./costco');

async function checkAvailability(store, query) {
  switch (store.toLowerCase()) {
    case 'walmart': return walmart.check(query);
    case 'target': return target.check(query);
    case 'costco': return costco.check(query);
    default: throw new Error(`Unknown store: ${store}`);
  }
}

async function scrapeByUrl(url) {
  if (/walmart\.com/i.test(url)) return walmart.scrapeUrl(url);
  if (/target\.com/i.test(url)) return target.scrapeUrl(url);
  if (/costco\.com/i.test(url)) return costco.scrapeUrl(url);
  throw new Error(`Unsupported store URL: ${url}`);
}

module.exports = { checkAvailability, scrapeByUrl };
