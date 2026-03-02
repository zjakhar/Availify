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

module.exports = { checkAvailability };
