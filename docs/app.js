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
  user: null,
  watchlist: [],
  searchResults: null,    // null = no search yet, [] = no results
  searchLoading: false,
  editingItem: null,      // watchlist item being edited
  message: null,          // { type: 'success'|'error'|'info', text: string }
};

// =====================
// NAVIGATION
// =====================
function navigate(view, message) {
  state.view = view;
  state.message = message || null;
  state.searchResults = null;
  state.searchLoading = false;
  state.editingItem = null;
  render();
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
      <main class="dashboard-body">
        <div class="dashboard-grid">

          <!-- Search Panel -->
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

          <!-- Watchlist Panel -->
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

        </div>
      </main>
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

  return `
    <div class="watchlist-item" data-id="${escapeHtml(item.id)}">
      <div class="watchlist-item-info">
        <div class="watchlist-item-name" title="${escapeHtml(item.query)}">${escapeHtml(item.query)}</div>
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
  const badge = document.getElementById('watchlist-count-badge');
  if (badge) badge.textContent = state.watchlist.length;
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
    document.getElementById('search-form').addEventListener('submit', handleSearch);
    document.getElementById('wl-add-form').addEventListener('submit', handleAddWatchlistItem);
    attachWatchlistListeners();
    attachSearchResultListeners();
  }
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
