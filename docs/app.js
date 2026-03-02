/* global localStorage, sessionStorage */
// DEMO NOTICE: This is a front-end demonstration. User credentials are stored
// in plain text in the browser's localStorage. In a production application,
// never store passwords client-side; use a secure server-side authentication
// service (e.g. OAuth, JWT with a backend API) instead.

// =====================
// CONSTANTS
// =====================
const STORES = ['walmart', 'target', 'costco'];
const STORE_LABELS = { walmart: 'Walmart 🛒', target: 'Target 🎯', costco: 'Costco 🏪' };
const STORE_COLORS = { walmart: 'store-walmart', target: 'store-target', costco: 'store-costco' };

// Pre-configured featured items per store tab
const FEATURED_ITEMS = {
  target: [
    {
      id: 'target-94300067',
      store: 'target',
      tcin: '94300067',
      name: 'Pokémon TCG: Scarlet & Violet—Destined Rivals Booster Bundle',
      url: 'https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-8212-destined-rivals-booster-bundle/-/A-94300067',
      image: 'https://target.scene7.com/is/image/Target/94300067?wid=325&hei=325&fmt=pjpeg&qlt=80',
    },
    {
      id: 'target-94300069',
      store: 'target',
      tcin: '94300069',
      name: 'Pokémon TCG: Scarlet & Violet—Destined Rivals Elite Trainer Box',
      url: 'https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-8212-destined-rivals-elite-trainer-box/-/A-94300069',
      image: 'https://target.scene7.com/is/image/Target/94300069?wid=325&hei=325&fmt=pjpeg&qlt=80',
    },
  ],
  walmart: [
    {
      id: 'walmart-15042474261',
      store: 'walmart',
      itemId: '15042474261',
      name: 'Pokémon TCG: Scarlet & Violet—Journey Together Booster Bundle',
      url: 'https://www.walmart.com/ip/Pokemon-Trading-Card-Games-Scarlet-Violet-9-Journey-Together-Booster-Bundle/15042474261',
      image: null,
    },
    {
      id: 'walmart-18710966734',
      store: 'walmart',
      itemId: '18710966734',
      name: 'Pokémon TCG: Mega Evolution Ascended Heroes Elite Trainer Box',
      url: 'https://www.walmart.com/ip/Pok-mon-Trading-Card-Game-Mega-Evolution-Ascended-Heroes-Elite-Trainer-Box/18710966734',
      image: null,
    },
  ],
  costco: [
    {
      id: 'costco-4000114207',
      store: 'costco',
      itemId: '4000114207',
      name: 'Pokémon 3-Pack Stacking Tins with Booster Packs',
      url: 'https://www.costco.com/pok%C3%A9mon-3-pack-stacking-tins-with-booster-packs.product.4000114207.html',
      image: null,
    },
  ],
};

// =====================
// STORAGE HELPERS
// =====================
function getUsers() {
  return JSON.parse(localStorage.getItem('availify_users') || '[]');
}
function saveUsers(users) {
  localStorage.setItem('availify_users', JSON.stringify(users));
}
function getSession() {
  return JSON.parse(sessionStorage.getItem('availify_session') || 'null');
}
function setSession(user) {
  sessionStorage.setItem('availify_session', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
}
function clearSession() {
  sessionStorage.removeItem('availify_session');
}
function getWatchlist(userId) {
  return JSON.parse(localStorage.getItem('availify_wl_' + userId) || '[]');
}
function saveWatchlist(userId, items) {
  localStorage.setItem('availify_wl_' + userId, JSON.stringify(items));
}

// =====================
// STATE
// =====================
let state = {
  view: 'login',          // 'login' | 'signup' | 'resetPassword' | 'dashboard'
  activeTab: 'search',    // 'search' | 'target' | 'walmart' | 'costco' | 'watchlist'
  user: null,
  watchlist: [],
  searchResults: null,    // null = no search yet, [] = no results
  searchLoading: false,
  editingItem: null,      // watchlist item being edited
  message: null,          // { type: 'success'|'error'|'info', text: string }
  featuredItemData: {},   // item.id → { price, inStock, image, loading }
};

// =====================
// NAVIGATION
// =====================
function navigate(view, message) {
  state.view = view;
  state.activeTab = 'search';
  state.message = message || null;
  state.searchResults = null;
  state.searchLoading = false;
  state.editingItem = null;
  render();
}

// =====================
// TAB SWITCHING
// =====================
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  const container = document.getElementById('tab-content');
  if (container) {
    container.innerHTML = getTabContentHTML();
    attachTabContentListeners();
    if (['target', 'walmart', 'costco'].includes(tab)) {
      loadStoreTabData(tab);
    }
  }
}

// =====================
// LIVE DATA FETCHING
// NOTE: The Target API key below is a publicly known, browser-facing key embedded
// in Target's own web pages. The allorigins proxy is used only to bypass browser
// CORS restrictions for a static GitHub Pages deployment; a production deployment
// should use a dedicated backend proxy instead.
// =====================
async function fetchTargetItemData(tcin) {
  try {
    // Try the product detail page API first
    const pdpUrl = `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&tcin=${encodeURIComponent(tcin)}&pricing_store_id=1148&visitor_id=018a4f66-7697-4a8b-b982-55de86a92c59&channel=WEB&page=%2Fp%2FA-${encodeURIComponent(tcin)}`;
    const resp = await fetch(pdpUrl, { headers: { 'Accept': 'application/json' } });
    if (resp.ok) {
      const data = await resp.json();
      const product = data?.data?.product;
      if (product) {
        const desc = product.item?.product_description || {};
        const price = product.price || {};
        const avail = product.availability || {};
        const images = product.item?.enrichment?.images || {};
        return {
          name: desc.title || null,
          price: price.current_retail != null ? `$${Number(price.current_retail).toFixed(2)}` : null,
          inStock: avail.availability_status === 'IN_STOCK' || avail.availability_status === 'AVAILABLE',
          image: images.primary_image_url || null,
        };
      }
    }
    // Fallback: search API with TCIN as keyword
    const searchUrl = `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&keyword=${encodeURIComponent(tcin)}&count=5&offset=0&channel=WEB&country=US&locale=en-US`;
    const sr = await fetch(searchUrl, { headers: { 'Accept': 'application/json' } });
    if (!sr.ok) throw new Error('Search API error');
    const sdata = await sr.json();
    const products = sdata?.data?.search?.products || [];
    const match = products.find(p => p.item?.tcin === tcin) || products[0];
    if (!match) return null;
    const it = match.item || {};
    const desc = it.product_description || {};
    const priceObj = it.price || {};
    return {
      name: desc.title || null,
      price: priceObj.current_retail != null ? `$${Number(priceObj.current_retail).toFixed(2)}` : null,
      inStock: it.availability_status === 'IN_STOCK' || it.availability_status === 'AVAILABLE',
      image: it.enrichment?.images?.primary_image_url || null,
    };
  } catch (e) {
    return null;
  }
}

async function fetchWalmartItemData(itemId) {
  try {
    const walmartUrl = `https://www.walmart.com/ip/${encodeURIComponent(itemId)}`;
    const resp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(walmartUrl)}`);
    if (!resp.ok) throw new Error('Proxy error');
    const data = await resp.json();
    const html = data.contents || '';
    // Try __NEXT_DATA__ (Walmart's Next.js SSR payload)
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (m) {
      const nextData = JSON.parse(m[1]);
      const prod = nextData?.props?.pageProps?.initialData?.data?.product;
      if (prod) {
        return {
          name: prod.name || null,
          price: prod.priceInfo?.currentPrice?.price != null ? `$${prod.priceInfo.currentPrice.price}` : null,
          inStock: prod.availabilityStatus === 'IN_STOCK',
          image: prod.imageInfo?.thumbnailUrl || null,
        };
      }
    }
    // Try JSON-LD
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (ldMatch) {
      const ld = JSON.parse(ldMatch[1]);
      const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
      return {
        name: ld.name || null,
        price: offer?.price != null ? `$${offer.price}` : null,
        inStock: (offer?.availability || '').includes('InStock'),
        image: Array.isArray(ld.image) ? ld.image[0] : (ld.image || null),
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchCostcoItemData(itemUrl) {
  try {
    const resp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(itemUrl)}`);
    if (!resp.ok) throw new Error('Proxy error');
    const data = await resp.json();
    const html = data.contents || '';
    // Try JSON-LD
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (ldMatch) {
      const ld = JSON.parse(ldMatch[1]);
      const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
      return {
        name: ld.name || null,
        price: offer?.price != null ? `$${offer.price}` : null,
        inStock: (offer?.availability || '').includes('InStock'),
        image: Array.isArray(ld.image) ? ld.image[0] : (ld.image || null),
      };
    }
    // Fallback HTML parse via DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const name = doc.querySelector('h1')?.textContent?.trim() || null;
    const priceText = doc.querySelector('.value')?.textContent?.trim() || null;
    const img = doc.querySelector('.product-img img, .cloudzoom img')?.src || null;
    return { name, price: priceText, inStock: null, image: img };
  } catch (e) {
    return null;
  }
}

async function loadStoreTabData(store) {
  const items = FEATURED_ITEMS[store] || [];
  const toFetch = items.filter(item => !state.featuredItemData[item.id]);
  if (toFetch.length === 0) return;

  // Mark items as loading and re-render cards
  toFetch.forEach(item => {
    state.featuredItemData[item.id] = { loading: true };
  });
  if (state.activeTab === store) {
    const grid = document.getElementById(`featured-grid-${store}`);
    if (grid) {
      grid.innerHTML = items.map(item => featuredCardHTML(item)).join('');
      attachFeaturedCardListenersAll(store);
    }
  }

  // Fetch all items in parallel
  await Promise.all(toFetch.map(async (item) => {
    let liveData = null;
    try {
      if (store === 'target' && item.tcin) {
        liveData = await fetchTargetItemData(item.tcin);
      } else if (store === 'walmart' && item.itemId) {
        liveData = await fetchWalmartItemData(item.itemId);
      } else if (store === 'costco') {
        liveData = await fetchCostcoItemData(item.url);
      }
    } catch (e) {
      // Log the error for debugging; liveData stays null and the card falls back to static data
      console.warn(`[Availify] Failed to fetch live data for "${item.name}":`, e.message);
    }
    state.featuredItemData[item.id] = { loading: false, ...(liveData || {}) };

    // Update just this card if still on the same tab
    if (state.activeTab === store) {
      const cardEl = document.getElementById(`featured-card-${item.id}`);
      if (cardEl) {
        const temp = document.createElement('div');
        temp.innerHTML = featuredCardHTML(item);
        const newCard = temp.firstElementChild;
        cardEl.replaceWith(newCard);
        attachFeaturedCardListeners(newCard, item);
      }
    }
  }));
}

// =====================
// AUTH ACTIONS
// =====================
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    showMessage('error', 'Invalid email or password.');
    return;
  }
  setSession(user);
  state.user = { id: user.id, name: user.name, email: user.email };
  state.watchlist = getWatchlist(user.id);
  navigate('dashboard');
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  if (!name || !email || !password) {
    showMessage('error', 'All fields are required.');
    return;
  }
  if (password !== confirm) {
    showMessage('error', 'Passwords do not match.');
    return;
  }
  if (password.length < 6) {
    showMessage('error', 'Password must be at least 6 characters.');
    return;
  }
  const users = getUsers();
  if (users.find(u => u.email === email)) {
    showMessage('error', 'An account with this email already exists.');
    return;
  }
  const user = { id: Date.now().toString(), name, email, password };
  users.push(user);
  saveUsers(users);
  navigate('login', { type: 'success', text: 'Account created! You can now log in.' });
}

function handleResetPassword(e) {
  e.preventDefault();
  const email = document.getElementById('reset-email').value.trim().toLowerCase();
  const name = document.getElementById('reset-name').value.trim();
  const newPassword = document.getElementById('reset-password').value;
  const confirm = document.getElementById('reset-confirm').value;
  if (!email || !name || !newPassword) {
    showMessage('error', 'All fields are required.');
    return;
  }
  if (newPassword !== confirm) {
    showMessage('error', 'Passwords do not match.');
    return;
  }
  if (newPassword.length < 6) {
    showMessage('error', 'Password must be at least 6 characters.');
    return;
  }
  const users = getUsers();
  const idx = users.findIndex(
    u => u.email === email && u.name.toLowerCase() === name.toLowerCase()
  );
  if (idx === -1) {
    showMessage('error', 'No account found matching that email and name.');
    return;
  }
  users[idx].password = newPassword;
  saveUsers(users);
  navigate('login', { type: 'success', text: 'Password reset successfully. You can now log in.' });
}

function handleLogout() {
  clearSession();
  state.user = null;
  state.watchlist = [];
  navigate('login');
}

// =====================
// WATCHLIST ACTIONS
// =====================
function handleAddWatchlistItem(e) {
  e.preventDefault();
  const store = document.getElementById('wl-store').value;
  const query = document.getElementById('wl-query').value.trim();
  if (!store || !query) {
    showMessage('error', 'Please select a store and enter an item to watch.');
    return;
  }
  const duplicate = state.watchlist.find(i => i.store === store && i.query.toLowerCase() === query.toLowerCase());
  if (duplicate) {
    showMessage('error', `You're already watching "${query}" at ${STORE_LABELS[store]}.`);
    return;
  }
  const item = {
    id: Date.now().toString(),
    store,
    query,
    addedAt: new Date().toISOString(),
    lastStatus: null,
  };
  state.watchlist.push(item);
  saveWatchlist(state.user.id, state.watchlist);
  document.getElementById('wl-query').value = '';
  renderWatchlist();
}

function handleDeleteWatchlistItem(id) {
  state.watchlist = state.watchlist.filter(i => i.id !== id);
  saveWatchlist(state.user.id, state.watchlist);
  renderWatchlist();
  // Refresh store tab cards so Watch/Remove buttons update
  if (['target', 'walmart', 'costco'].includes(state.activeTab)) {
    const grid = document.getElementById(`featured-grid-${state.activeTab}`);
    if (grid) {
      const items = FEATURED_ITEMS[state.activeTab] || [];
      grid.innerHTML = items.map(item => featuredCardHTML(item)).join('');
      attachFeaturedCardListenersAll(state.activeTab);
    }
  }
}

function openEditModal(id) {
  state.editingItem = state.watchlist.find(i => i.id === id) || null;
  renderModal();
}

function handleEditWatchlistItem(e) {
  e.preventDefault();
  const store = document.getElementById('edit-store').value;
  const query = document.getElementById('edit-query').value.trim();
  if (!store || !query) return;
  const duplicate = state.watchlist.find(
    i => i.id !== state.editingItem.id && i.store === store && i.query.toLowerCase() === query.toLowerCase()
  );
  if (duplicate) {
    const errEl = document.getElementById('edit-error');
    if (errEl) errEl.textContent = `Already watching "${query}" at ${STORE_LABELS[store]}.`;
    return;
  }
  state.watchlist = state.watchlist.map(i =>
    i.id === state.editingItem.id ? { ...i, store, query } : i
  );
  saveWatchlist(state.user.id, state.watchlist);
  state.editingItem = null;
  closeModal();
  renderWatchlist();
}

function closeModal() {
  state.editingItem = null;
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
}

// =====================
// FEATURED ITEM WATCHLIST ACTIONS
// =====================
function isFeaturedItemOnWatchlist(item) {
  return state.watchlist.some(
    w => (w.url && w.url === item.url) ||
         (w.store === item.store && w.query === item.name)
  );
}

function handleAddFeaturedItemToWatchlist(item) {
  if (isFeaturedItemOnWatchlist(item)) {
    showStoreMessage(item.store, 'info', `"${item.name}" is already on your watchlist.`);
    return;
  }
  const liveData = state.featuredItemData[item.id] || {};
  const wlItem = {
    id: Date.now().toString(),
    store: item.store,
    query: item.name,
    url: item.url,
    price: liveData.price || null,
    image: liveData.image || item.image || null,
    addedAt: new Date().toISOString(),
    lastStatus: liveData.inStock != null
      ? { available: liveData.inStock, products: [] }
      : null,
  };
  state.watchlist.push(wlItem);
  saveWatchlist(state.user.id, state.watchlist);
  updateTabBadge();
  // Update the card to show "Remove" button
  refreshFeaturedCard(item);
  showStoreMessage(item.store, 'success', `"${item.name}" added to your watchlist!`);
}

function handleRemoveFeaturedItemFromWatchlist(item) {
  const wlItem = state.watchlist.find(
    w => (w.url && w.url === item.url) ||
         (w.store === item.store && w.query === item.name)
  );
  if (!wlItem) return;
  state.watchlist = state.watchlist.filter(w => w.id !== wlItem.id);
  saveWatchlist(state.user.id, state.watchlist);
  updateTabBadge();
  // Update the card to show "Watch" button
  refreshFeaturedCard(item);
  showStoreMessage(item.store, 'info', `"${item.name}" removed from your watchlist.`);
}

function refreshFeaturedCard(item) {
  const cardEl = document.getElementById(`featured-card-${item.id}`);
  if (cardEl) {
    const temp = document.createElement('div');
    temp.innerHTML = featuredCardHTML(item);
    const newCard = temp.firstElementChild;
    cardEl.replaceWith(newCard);
    attachFeaturedCardListeners(newCard, item);
  }
}

function updateTabBadge() {
  const tabBadge = document.querySelector('.nav-tab[data-tab="watchlist"] .tab-badge');
  if (tabBadge) tabBadge.textContent = state.watchlist.length;
  const countBadge = document.getElementById('watchlist-count-badge');
  if (countBadge) countBadge.textContent = state.watchlist.length;
}

// =====================
// SEARCH ACTIONS
// =====================
function handleSearch(e) {
  e.preventDefault();
  const store = document.getElementById('search-store').value;
  const query = document.getElementById('search-query').value.trim();
  if (!store || !query) return;
  state.searchLoading = true;
  state.searchResults = null;
  renderSearchResults();

  // Simulate async search with mock data
  setTimeout(() => {
    state.searchResults = mockSearch(store, query);
    state.searchLoading = false;
    renderSearchResults();
  }, 800);
}

function handleAddResultToWatchlist(store, query) {
  const duplicate = state.watchlist.find(
    i => i.store === store && i.query.toLowerCase() === query.toLowerCase()
  );
  if (duplicate) {
    showSearchMessage('info', `"${escapeHtml(query)}" is already on your watchlist for ${STORE_LABELS[store]}.`);
    return;
  }
  const item = {
    id: Date.now().toString(),
    store,
    query,
    addedAt: new Date().toISOString(),
    lastStatus: null,
  };
  state.watchlist.push(item);
  saveWatchlist(state.user.id, state.watchlist);
  renderWatchlist();
  // Re-render button as added
  renderSearchResults();
}

// =====================
// MOCK SEARCH DATA
// =====================
const MOCK_PRODUCTS = {
  walmart: [
    { suffix: '- Standard Edition', basePrice: 29.99 },
    { suffix: '- Value Pack', basePrice: 49.99 },
    { suffix: '- Bulk Bundle (2-Pack)', basePrice: 54.99 },
    { suffix: '- Walmart Exclusive', basePrice: 39.99 },
  ],
  target: [
    { suffix: '- Premium', basePrice: 34.99 },
    { suffix: '- Target Exclusive', basePrice: 44.99 },
    { suffix: '- Limited Edition', basePrice: 59.99 },
    { suffix: '- Circle Offer', basePrice: 27.99 },
  ],
  costco: [
    { suffix: '- Costco Bulk Pack', basePrice: 89.99 },
    { suffix: '- Family Size', basePrice: 64.99 },
    { suffix: '- Member\'s Mark', basePrice: 74.99 },
    { suffix: '- Kirkland Signature', basePrice: 54.99 },
  ],
};

function mockSearch(store, query) {
  const templates = MOCK_PRODUCTS[store] || MOCK_PRODUCTS.walmart;
  return templates.map((tpl, i) => {
    const seed = (query.length + i) % 3;
    const available = seed !== 0;
    const price = (tpl.basePrice + query.length % 10).toFixed(2);
    return {
      name: query + ' ' + tpl.suffix,
      price: '$' + price,
      available,
      store,
    };
  });
}

// =====================
// MESSAGE HELPER
// =====================
function showMessage(type, text) {
  state.message = { type, text };
  const container = document.getElementById('message-container');
  if (container) {
    container.innerHTML = alertHTML(type, text);
  }
}

function showSearchMessage(type, text) {
  const container = document.getElementById('search-message-container');
  if (container) {
    container.innerHTML = alertHTML(type, text);
    setTimeout(() => { if (container) container.innerHTML = ''; }, 4000);
  }
}

function showStoreMessage(store, type, text) {
  const container = document.getElementById(`store-message-${store}`);
  if (container) {
    container.innerHTML = alertHTML(type, text);
    setTimeout(() => { if (container) container.innerHTML = ''; }, 4000);
  }
}

function alertHTML(type, text) {
  const cls = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-info';
  return `<div class="alert ${cls}">${escapeHtml(text)}</div>`;
}

// =====================
// ESCAPE HELPER
// =====================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =====================
// RENDER – AUTH VIEWS
// =====================
function renderLogin() {
  return `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <span class="logo-icon">📦</span>
          <span class="logo-text">Availify</span>
        </div>
        <h2>Sign In</h2>
        <div id="message-container">
          ${state.message ? alertHTML(state.message.type, state.message.text) : ''}
        </div>
        <form id="login-form" novalidate>
          <div class="form-group">
            <label for="login-email">Email address</label>
            <input type="email" id="login-email" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-block mt-2">Sign In</button>
        </form>
        <div class="auth-links mt-2">
          <a id="link-reset">Forgot your password?</a>
        </div>
        <div class="auth-links mt-1">
          Don't have an account? <a id="link-signup">Create one</a>
        </div>
      </div>
    </div>
  `;
}

function renderSignup() {
  return `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <span class="logo-icon">📦</span>
          <span class="logo-text">Availify</span>
        </div>
        <h2>Create Account</h2>
        <div id="message-container">
          ${state.message ? alertHTML(state.message.type, state.message.text) : ''}
        </div>
        <form id="signup-form" novalidate>
          <div class="form-group">
            <label for="signup-name">Full Name</label>
            <input type="text" id="signup-name" placeholder="Jane Smith" required autocomplete="name" />
          </div>
          <div class="form-group">
            <label for="signup-email">Email address</label>
            <input type="email" id="signup-email" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="signup-password">Password</label>
            <input type="password" id="signup-password" placeholder="Min. 6 characters" required autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label for="signup-confirm">Confirm Password</label>
            <input type="password" id="signup-confirm" placeholder="Repeat password" required autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-block mt-2">Create Account</button>
        </form>
        <div class="auth-links mt-2">
          Already have an account? <a id="link-login">Sign in</a>
        </div>
      </div>
    </div>
  `;
}

function renderResetPassword() {
  return `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <span class="logo-icon">📦</span>
          <span class="logo-text">Availify</span>
        </div>
        <h2>Reset Password</h2>
        <div id="message-container">
          ${state.message ? alertHTML(state.message.type, state.message.text) : ''}
        </div>
        <form id="reset-form" novalidate>
          <div class="form-group">
            <label for="reset-email">Email address</label>
            <input type="email" id="reset-email" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="reset-name">Full Name (to verify your identity)</label>
            <input type="text" id="reset-name" placeholder="As entered at sign-up" required autocomplete="name" />
          </div>
          <div class="form-group">
            <label for="reset-password">New Password</label>
            <input type="password" id="reset-password" placeholder="Min. 6 characters" required autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label for="reset-confirm">Confirm New Password</label>
            <input type="password" id="reset-confirm" placeholder="Repeat new password" required autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-block mt-2">Reset Password</button>
        </form>
        <div class="auth-links mt-2">
          Remembered it? <a id="link-login">Back to Sign In</a>
        </div>
      </div>
    </div>
  `;
}

// =====================
// RENDER – DASHBOARD
// =====================
function renderDashboard() {
  return `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="header-brand">
          <span class="brand-icon">📦</span> Availify
        </div>
        <div class="header-user">
          <span class="welcome">Hi, ${escapeHtml(state.user.name.split(' ')[0])} 👋</span>
          <button id="btn-logout" class="btn btn-sm btn-secondary">Logout</button>
        </div>
      </header>
      <nav class="tab-nav">
        <button class="nav-tab${state.activeTab === 'search' ? ' active' : ''}" data-tab="search">🔍 Search</button>
        <button class="nav-tab${state.activeTab === 'target' ? ' active' : ''}" data-tab="target">🎯 Target</button>
        <button class="nav-tab${state.activeTab === 'walmart' ? ' active' : ''}" data-tab="walmart">🛒 Walmart</button>
        <button class="nav-tab${state.activeTab === 'costco' ? ' active' : ''}" data-tab="costco">🏪 Costco</button>
        <button class="nav-tab${state.activeTab === 'watchlist' ? ' active' : ''}" data-tab="watchlist">
          ⭐ Watchlist <span class="tab-badge">${state.watchlist.length}</span>
        </button>
      </nav>
      <main class="dashboard-body">
        <div id="tab-content">
          ${getTabContentHTML()}
        </div>
      </main>
    </div>
  `;
}

function getTabContentHTML() {
  switch (state.activeTab) {
    case 'search':    return renderSearchTab();
    case 'target':    return renderStoreTab('target');
    case 'walmart':   return renderStoreTab('walmart');
    case 'costco':    return renderStoreTab('costco');
    case 'watchlist': return renderWatchlistTab();
    default:          return renderSearchTab();
  }
}

// =====================
// RENDER – SEARCH TAB
// =====================
function renderSearchTab() {
  return `
    <div class="card">
      <div class="card-header">
        <h3>🔍 Search Inventory</h3>
      </div>
      <div class="card-body">
        <form id="search-form" class="search-form">
          <div class="search-row">
            <select id="search-store">
              <option value="">Store…</option>
              ${STORES.map(s => `<option value="${s}">${STORE_LABELS[s]}</option>`).join('')}
            </select>
            <input type="text" id="search-query" placeholder="Search for an item…" autocomplete="off" />
          </div>
          <button type="submit" class="btn btn-primary">Search</button>
        </form>
        <div id="search-message-container"></div>
        <div id="search-results-container" class="search-results"></div>
      </div>
    </div>
  `;
}

// =====================
// RENDER – STORE TABS
// =====================
function renderStoreTab(store) {
  const items = FEATURED_ITEMS[store] || [];
  const label = STORE_LABELS[store];
  return `
    <div class="card">
      <div class="card-header">
        <h3>${label} – Featured Items</h3>
        <button class="btn btn-sm btn-outline btn-refresh-store" data-store="${escapeHtml(store)}">🔄 Refresh</button>
      </div>
      <div class="card-body">
        <div id="store-message-${escapeHtml(store)}"></div>
        <div class="featured-grid" id="featured-grid-${escapeHtml(store)}">
          ${items.map(item => featuredCardHTML(item)).join('')}
        </div>
      </div>
    </div>
  `;
}

function featuredCardHTML(item) {
  const liveData = state.featuredItemData[item.id] || {};
  const loading = liveData.loading === true;
  const onWatchlist = isFeaturedItemOnWatchlist(item);
  const imageUrl = liveData.image || item.image;

  const imageHTML = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" class="featured-card-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="featured-card-img-placeholder" style="display:none">${escapeHtml(STORE_LABELS[item.store].split(' ').pop())}</div>`
    : `<div class="featured-card-img-placeholder">${escapeHtml(STORE_LABELS[item.store].split(' ').pop())}</div>`;

  let stockBadge;
  if (loading) {
    stockBadge = `<span class="badge" style="background:#F3F4F6;color:#6B7280;"><span class="spinner-xs"></span> Loading…</span>`;
  } else if (liveData.inStock === true) {
    stockBadge = `<span class="badge badge-in-stock">✅ In Stock</span>`;
  } else if (liveData.inStock === false) {
    stockBadge = `<span class="badge badge-out-of-stock">❌ Out of Stock</span>`;
  } else {
    stockBadge = `<span class="badge" style="background:#F3F4F6;color:#6B7280;">⏳ Check site</span>`;
  }

  const priceHTML = liveData.price
    ? `<div class="featured-card-price">${escapeHtml(liveData.price)}</div>`
    : (loading ? `<div class="featured-card-price featured-card-price--loading">Loading…</div>` : '');

  const watchBtn = onWatchlist
    ? `<button class="btn btn-sm btn-danger btn-remove-featured" data-item-id="${escapeHtml(item.id)}">🗑️ Remove</button>`
    : `<button class="btn btn-sm btn-success btn-add-featured" data-item-id="${escapeHtml(item.id)}">+ Watch</button>`;

  return `
    <div class="featured-card" id="featured-card-${escapeHtml(item.id)}">
      <div class="featured-card-image">
        ${imageHTML}
      </div>
      <div class="featured-card-body">
        <div class="featured-card-name">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>
        </div>
        ${priceHTML}
        <div class="featured-card-status">${stockBadge}</div>
      </div>
      <div class="featured-card-actions">
        ${watchBtn}
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">View →</a>
      </div>
    </div>
  `;
}

// =====================
// RENDER – WATCHLIST TAB
// =====================
function renderWatchlistTab() {
  return `
    <div class="card">
      <div class="card-header">
        <h3>⭐ My Watchlist</h3>
        <span id="watchlist-count-badge" class="watchlist-count">${state.watchlist.length}</span>
      </div>
      <div class="card-body">
        <form id="wl-add-form" class="watchlist-add-form">
          <select id="wl-store">
            <option value="">Store…</option>
            ${STORES.map(s => `<option value="${s}">${STORE_LABELS[s]}</option>`).join('')}
          </select>
          <input type="text" id="wl-query" placeholder="Item to watch…" autocomplete="off" />
          <button type="submit" class="btn btn-success btn-sm">+ Add</button>
        </form>
        <div id="watchlist-container" class="panel-scroll">
          ${watchlistHTML()}
        </div>
      </div>
    </div>
  `;
}

function watchlistHTML() {
  if (state.watchlist.length === 0) {
    return `<div class="empty-state"><span class="empty-icon">📋</span>No items yet.<br>Add something to watch above.</div>`;
  }
  return `<div class="watchlist-items">${state.watchlist.map(item => watchlistItemHTML(item)).join('')}</div>`;
}

function watchlistItemHTML(item) {
  const statusBadge = item.lastStatus
    ? (item.lastStatus.available
        ? `<span class="badge badge-in-stock">✅ In Stock</span>`
        : `<span class="badge badge-out-of-stock">❌ Out of Stock</span>`)
    : `<span class="badge" style="background:#F3F4F6;color:#6B7280;">⏳ Not checked</span>`;

  const added = new Date(item.addedAt).toLocaleDateString();
  const urlLink = item.url
    ? ` <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="wl-item-link" title="View on site">↗</a>`
    : '';

  return `
    <div class="watchlist-item" data-id="${escapeHtml(item.id)}">
      <div class="watchlist-item-info">
        <div class="watchlist-item-name" title="${escapeHtml(item.query)}">${escapeHtml(item.query)}${urlLink}</div>
        <div class="watchlist-item-meta">
          <span class="${STORE_COLORS[item.store]} font-semibold">${STORE_LABELS[item.store]}</span>
          &nbsp;•&nbsp;Added ${added}
          &nbsp;•&nbsp;${statusBadge}
        </div>
      </div>
      <div class="watchlist-item-actions">
        <button class="btn btn-outline btn-sm btn-edit-wl" data-id="${escapeHtml(item.id)}" title="Edit">✏️</button>
        <button class="btn btn-danger btn-sm btn-delete-wl" data-id="${escapeHtml(item.id)}" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

function searchResultsHTML() {
  if (state.searchLoading) {
    return `<div class="searching-indicator"><div class="spinner"></div><br>Searching…</div>`;
  }
  if (state.searchResults === null) return '';
  if (state.searchResults.length === 0) {
    return `<div class="empty-state"><span class="empty-icon">🔍</span>No results found.</div>`;
  }
  return state.searchResults.map(r => {
    const onWatchlist = state.watchlist.some(
      i => i.store === r.store && i.query.toLowerCase() === r.name.toLowerCase()
    );
    const stockBadge = r.available
      ? `<span class="badge badge-in-stock">✅ In Stock</span>`
      : `<span class="badge badge-out-of-stock">❌ Out of Stock</span>`;
    const addBtn = onWatchlist
      ? `<button class="btn btn-sm btn-secondary" disabled>✅ Watching</button>`
      : `<button class="btn btn-sm btn-outline btn-add-result"
           data-store="${escapeHtml(r.store)}" data-query="${escapeHtml(r.name)}">+ Watch</button>`;
    return `
      <div class="result-item">
        <div class="result-info">
          <div class="result-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</div>
          <div class="result-price">${escapeHtml(r.price)}</div>
          <div class="result-meta">${stockBadge}</div>
        </div>
        <div class="result-actions">
          ${addBtn}
        </div>
      </div>
    `;
  }).join('');
}

function renderModal() {
  const existing = document.getElementById('modal-overlay');
  if (existing) existing.remove();

  if (!state.editingItem) return;
  const item = state.editingItem;

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h3 id="modal-title">✏️ Edit Watchlist Item</h3>
      <div id="edit-error" style="color:#B91C1C;font-size:0.85rem;margin-bottom:0.5rem;min-height:1.2em;"></div>
      <form id="edit-form">
        <div class="form-group">
          <label for="edit-store">Store</label>
          <select id="edit-store">
            ${STORES.map(s => `<option value="${s}" ${s === item.store ? 'selected' : ''}>${STORE_LABELS[s]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="edit-query">Item / Search Query</label>
          <input type="text" id="edit-query" value="${escapeHtml(item.query)}" required />
        </div>
        <div class="modal-actions">
          <button type="button" id="btn-cancel-edit" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('btn-cancel-edit').addEventListener('click', closeModal);
  document.getElementById('edit-form').addEventListener('submit', handleEditWatchlistItem);
  document.getElementById('edit-query').focus();
}

// =====================
// PARTIAL RE-RENDERS
// =====================
function renderWatchlist() {
  const container = document.getElementById('watchlist-container');
  if (container) container.innerHTML = watchlistHTML();
  updateTabBadge();
  attachWatchlistListeners();
}

function renderSearchResults() {
  const container = document.getElementById('search-results-container');
  if (container) container.innerHTML = searchResultsHTML();
  attachSearchResultListeners();
}

// =====================
// EVENT LISTENERS
// =====================
function attachEventListeners() {
  const v = state.view;

  if (v === 'login') {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('link-signup').addEventListener('click', () => navigate('signup'));
    document.getElementById('link-reset').addEventListener('click', () => navigate('resetPassword'));
  }

  if (v === 'signup') {
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('link-login').addEventListener('click', () => navigate('login'));
  }

  if (v === 'resetPassword') {
    document.getElementById('reset-form').addEventListener('submit', handleResetPassword);
    document.getElementById('link-login').addEventListener('click', () => navigate('login'));
  }

  if (v === 'dashboard') {
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    attachTabContentListeners();
    // Trigger data load for the initial active store tab (if applicable)
    if (['target', 'walmart', 'costco'].includes(state.activeTab)) {
      loadStoreTabData(state.activeTab);
    }
  }
}

function attachTabContentListeners() {
  const tab = state.activeTab;
  if (tab === 'search') {
    const form = document.getElementById('search-form');
    if (form) form.addEventListener('submit', handleSearch);
    attachSearchResultListeners();
  }
  if (tab === 'watchlist') {
    const form = document.getElementById('wl-add-form');
    if (form) form.addEventListener('submit', handleAddWatchlistItem);
    attachWatchlistListeners();
  }
  if (['target', 'walmart', 'costco'].includes(tab)) {
    const refreshBtn = document.querySelector('.btn-refresh-store');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const store = refreshBtn.dataset.store;
        (FEATURED_ITEMS[store] || []).forEach(item => {
          delete state.featuredItemData[item.id];
        });
        loadStoreTabData(store);
      });
    }
    attachFeaturedCardListenersAll(tab);
  }
}

function attachFeaturedCardListenersAll(store) {
  (FEATURED_ITEMS[store] || []).forEach(item => {
    const card = document.getElementById(`featured-card-${item.id}`);
    if (card) attachFeaturedCardListeners(card, item);
  });
}

function attachFeaturedCardListeners(cardEl, item) {
  const addBtn = cardEl.querySelector('.btn-add-featured');
  if (addBtn) addBtn.addEventListener('click', () => handleAddFeaturedItemToWatchlist(item));
  const removeBtn = cardEl.querySelector('.btn-remove-featured');
  if (removeBtn) removeBtn.addEventListener('click', () => handleRemoveFeaturedItemFromWatchlist(item));
}

function attachWatchlistListeners() {
  document.querySelectorAll('.btn-edit-wl').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  document.querySelectorAll('.btn-delete-wl').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.confirming === 'true') {
        handleDeleteWatchlistItem(btn.dataset.id);
      } else {
        btn.dataset.confirming = 'true';
        btn.textContent = '✓?';
        btn.title = 'Click again to confirm delete';
        setTimeout(() => {
          if (btn.dataset.confirming === 'true') {
            btn.dataset.confirming = 'false';
            btn.textContent = '🗑️';
            btn.title = 'Delete';
          }
        }, 3000);
      }
    });
  });
}

function attachSearchResultListeners() {
  document.querySelectorAll('.btn-add-result').forEach(btn => {
    btn.addEventListener('click', () => {
      handleAddResultToWatchlist(btn.dataset.store, btn.dataset.query);
    });
  });
}

// =====================
// MAIN RENDER
// =====================
function render() {
  const app = document.getElementById('app');
  switch (state.view) {
    case 'login':         app.innerHTML = renderLogin(); break;
    case 'signup':        app.innerHTML = renderSignup(); break;
    case 'resetPassword': app.innerHTML = renderResetPassword(); break;
    case 'dashboard':     app.innerHTML = renderDashboard(); break;
    default:              app.innerHTML = renderLogin(); break;
  }
  attachEventListeners();
}

// =====================
// INIT
// =====================
window.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (session) {
    state.user = session;
    state.watchlist = getWatchlist(session.id);
    navigate('dashboard');
  } else {
    navigate('login');
  }
});
