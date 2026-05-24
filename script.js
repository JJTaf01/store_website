let shippingOptions = [];
let selectedShipping = 'standard';

const api = {
  async request(path, options = {}) {
    const fetchOpts = { credentials: 'include', headers: { 'Content-Type': 'application/json' } };
    Object.keys(options).forEach(k => { fetchOpts[k] = options[k]; });
    const res = await fetch(path, fetchOpts);
    const text = await res.text();
    if (!text) throw new Error('Server returned empty response (make sure server is running on http://localhost:3000)');
    try {
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (e) {
      if (e.name === 'SyntaxError') throw new Error('Invalid server response: ' + text.substring(0, 100));
      throw e;
    }
  },
  async checkAuth() { return this.request('/api/auth/me'); },
  async login(email, password) { return this.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); },
  async register(username, email, password) { return this.request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ username, email, password }) }); },
  async logout() { return this.request('/api/auth/logout', { method: 'POST' }); },
  async getProducts() { return this.request('/api/products'); },
  async getProduct(id) { return this.request(`/api/products/${id}`); },
  async createProduct(formData) {
    const res = await fetch('/api/products', { method: 'POST', credentials: 'include', body: formData });
    const text = await res.text();
    if (!text) throw new Error('Server empty response');
    const data = JSON.parse(text);
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  async updateProduct(id, formData) {
    const res = await fetch(`/api/products/${id}`, { method: 'PUT', credentials: 'include', body: formData });
    const text = await res.text();
    if (!text) throw new Error('Server empty response');
    const data = JSON.parse(text);
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  async deleteProduct(id) { return this.request(`/api/products/${id}`, { method: 'DELETE' }); },
  async getCart() { return this.request('/api/cart'); },
  async addToCart(productId, quantity = 1) { return this.request('/api/cart', { method: 'POST', body: JSON.stringify({ product_id: productId, quantity }) }); },
  async updateCartItem(itemId, quantity) { return this.request(`/api/cart/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }); },
  async removeCartItem(itemId) { return this.request(`/api/cart/${itemId}`, { method: 'DELETE' }); },
  async getWishlist() { return this.request('/api/wishlist'); },
  async addToWishlist(productId) { return this.request('/api/wishlist', { method: 'POST', body: JSON.stringify({ product_id: productId }) }); },
  async removeFromWishlist(productId) { return this.request(`/api/wishlist/${productId}`, { method: 'DELETE' }); },
  async createCheckoutSession() { return this.request('/api/create-checkout-session', { method: 'POST' }); },
  async createOrder() { return this.request('/api/create-order', { method: 'POST' }); },
  async getOrders() { return this.request('/api/orders'); },
  async getAdminStats() { return this.request('/api/admin/stats'); },
  async getAdminOrders() { return this.request('/api/admin/orders'); },
  async subscribeNewsletter(email, username) { return this.request('/api/newsletter', { method: 'POST', body: JSON.stringify({ email, username }) }); },
  async getNewsletterSubscribers() { return this.request('/api/newsletter'); },
  async sendNewsletter(subject, message) { return this.request('/api/admin/send-newsletter', { method: 'POST', body: JSON.stringify({ subject, message }) }); },
  async sendContactMessage(name, email, subject, message) { return this.request('/api/contact', { method: 'POST', body: JSON.stringify({ name, email, subject, message }) }); },
  async getShippingOptions() { return this.request('/api/shipping-options'); },
  async createCheckoutSession(shippingMethod) { return this.request('/api/create-checkout-session', { method: 'POST', body: JSON.stringify({ shipping_method: shippingMethod }) }); },
  async createOrder(shippingMethod) { return this.request('/api/create-order', { method: 'POST', body: JSON.stringify({ shipping_method: shippingMethod }) }); }
};

// ─── Auth ───────────────────────────────────────────────
async function checkAuth() {
  try { const data = await api.checkAuth(); currentUser = data.user; return data.user; }
  catch { currentUser = null; return null; }
}

let currentUser = null;
function isAdminMode() { return currentUser && currentUser.is_admin === 1; }
function setAdminMode(val) {
  if (!val && window.location.pathname.includes('dashboard.html')) window.location.href = 'index.html';
}

function updateAdminUI() {
  const admin = isAdminMode();
  const fab = document.getElementById('admin-fab');
  if (fab) fab.style.display = admin ? 'flex' : 'none';
  if (admin) showAdminBanner();
  else hideAdminBanner();
}

function showAdminBanner() {
  let banner = document.getElementById('admin-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'admin-banner';
    banner.className = 'admin-banner';
    banner.innerHTML = `Admin Mode Active <button onclick="showAdminModal()">+ Add Product</button> <button onclick="window.location.href='dashboard.html'">Dashboard</button> <button onclick="setAdminMode(false)">Exit Admin</button>`;
    document.body.prepend(banner);
  }
  banner.style.display = 'flex';
}

function hideAdminBanner() {
  const b = document.getElementById('admin-banner');
  if (b) b.style.display = 'none';
}

function updateNavbar(user) {
  const authLink = document.getElementById('auth-link');
  if (!authLink) return;
  const page = window.location.pathname.split('/').pop() || 'index.html';

  if (user) {
    if (page === 'dashboard.html' && !isAdminMode()) { window.location.href = 'index.html'; return; }
    authLink.innerHTML = `<a href="#" id="logoutBtn">${user.username} (Logout)</a>`;
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await api.logout();
      window.location.reload();
    });
  } else {
    authLink.innerHTML = `<a href="signup.html" id="signupBtn">Sign Up</a>`;
  }

  const adminNav = document.getElementById('admin-nav-item');
  if (adminNav) adminNav.style.display = isAdminMode() ? '' : 'none';

  if (isAdminMode()) {
    showAdminBanner();
    let fab = document.getElementById('admin-fab');
    if (!fab) {
      fab = document.createElement('div');
      fab.id = 'admin-fab'; fab.innerHTML = '+';
      fab.addEventListener('click', () => { if (isAdminMode()) showAdminModal(); });
      document.body.appendChild(fab);
    }
    fab.style.display = 'flex';
  } else {
    hideAdminBanner();
    const fab = document.getElementById('admin-fab');
    if (fab) fab.style.display = 'none';
  }
}

// ─── Admin Product Edit Modal ──────────────────────────
let editingProductId = null;

function showEditModal(product) {
  editingProductId = product.id;
  let modal = document.getElementById('admin-modal');
  if (!modal) createAdminModal();
  modal = document.getElementById('admin-modal');
  document.getElementById('modal-title').textContent = 'Edit Product';
  document.getElementById('admin-form').querySelector('input[name="name"]').value = product.name || '';
  document.getElementById('admin-form').querySelector('textarea[name="description"]').value = product.description || '';
  document.getElementById('admin-form').querySelector('input[name="price"]').value = product.price || '';
  document.getElementById('admin-form').querySelector('input[name="stock"]').value = product.stock || '';
  document.getElementById('admin-form').querySelector('select[name="category"]').value = product.category || 'Figure';
  document.getElementById('admin-submit-btn').textContent = 'Update Product';
  modal.style.display = 'flex';
}

function showAdminModal() {
  if (!isAdminMode()) { alert('Admin access required'); return; }
  editingProductId = null;
  let modal = document.getElementById('admin-modal');
  if (!modal) createAdminModal();
  modal = document.getElementById('admin-modal');
  document.getElementById('modal-title').textContent = 'Create Product';
  document.getElementById('admin-form').reset();
  document.getElementById('admin-submit-btn').textContent = 'Create Product';
  modal.style.display = 'flex';
}

function createAdminModal() {
  const modal = document.createElement('div');
  modal.id = 'admin-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="modal-close">&times;</span>
      <h2 id="modal-title">Create Product</h2>
      <form id="admin-form">
        <div class="form-group"><label>Product Name *</label><input type="text" name="name" required></div>
        <div class="form-group"><label>Description</label><textarea name="description" rows="3"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Price *</label><input type="number" name="price" step="0.01" min="0" required></div>
          <div class="form-group"><label>Stock</label><input type="number" name="stock" min="0" value="1"></div>
        </div>
        <div class="form-group"><label>Category</label><select name="category"><option>Figure</option><option>Cosplay</option><option>Stand</option><option>Other</option></select></div>
        <div class="form-group"><label>Image</label><input type="file" name="image" accept="image/*"></div>
        <button type="submit" class="modal-submit" id="admin-submit-btn">Create Product</button>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close').addEventListener('click', hideAdminModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) hideAdminModal(); });
  document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    try {
      if (editingProductId) { await api.updateProduct(editingProductId, formData); }
      else { await api.createProduct(formData); }
      hideAdminModal();
      form.reset();
      editingProductId = null;
      if (window.location.pathname.includes('dashboard.html')) loadDashboard();
      else loadProducts();
    } catch (err) { alert('Error: ' + err.message); }
  });
}

function hideAdminModal() {
  const m = document.getElementById('admin-modal');
  if (m) m.style.display = 'none';
}

// ─── Products ──────────────────────────────────────────
function renderProductCard(product) {
  const imgSrc = product.image || 'img/button.png';
  const stars = '<i class="fas fa-star"></i>'.repeat(5);
  const admin = isAdminMode();
  return `<div class="pro" data-id="${product.id}">
    <div class="img-container" style="position:relative">
      <img src="${imgSrc}" alt="${product.name}" onclick="window.location.href='sproduct.html?id=${product.id}'" style="cursor:pointer">
      <a href="#" class="wish-link" data-id="${product.id}" title="Add to wishlist"><i class="fa-regular fa-heart"></i></a>
    </div>
    <div class="des">
      <span>${product.category || 'Figure'}</span>
      <h5 onclick="window.location.href='sproduct.html?id=${product.id}'" style="cursor:pointer">${product.name}</h5>
      <div class="star">${stars}</div>
      <h4>€${parseFloat(product.price).toFixed(2)}</h4>
    </div>
    <a href="#" class="cart-link" data-id="${product.id}"><i class="fa-solid fa-cart-plus cart"></i></a>
    ${admin ? `<button class="edit-btn" data-id="${product.id}"><i class="fa-solid fa-pen"></i></button>` : ''}
    ${admin ? `<button class="delete-btn" data-id="${product.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
  </div>`;
}

async function loadProducts() {
  try {
    const data = await api.getProducts();
    const products = data.products;
    const singleBottom = document.querySelector('#product1.single-bottom .pro-container');
    const featured = document.querySelector('#product1:not(.new):not(.single-bottom) .pro-container');
    const newSection = document.querySelector('#product1.new .pro-container');
    if (singleBottom) singleBottom.innerHTML = products.slice(0, 4).map(p => renderProductCard(p)).join('');
    else if (featured) featured.innerHTML = products.slice(0, 8).map(p => renderProductCard(p)).join('');
    if (newSection) newSection.innerHTML = products.slice(8).map(p => renderProductCard(p)).join('');

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!isAdminMode()) { return; }
        if (confirm('Delete this product?')) {
          try { await api.deleteProduct(parseInt(btn.dataset.id)); loadProducts(); }
          catch (err) { alert('Error: ' + err.message); }
        }
      });
    });
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!isAdminMode()) { return; }
        const id = parseInt(btn.dataset.id);
        try { const d = await api.getProduct(id); showEditModal(d.product); }
        catch (err) { alert('Error: ' + err.message); }
      });
    });
  } catch (err) { console.error('Failed to load products:', err); }
}

// ─── Cart Events (Delegated) ──────────────────────────
document.addEventListener('click', async (e) => {
  const link = e.target.closest('.cart-link');
  if (link) {
    e.preventDefault();
    const productId = parseInt(link.dataset.id);
    const user = await checkAuth();
    if (!user) { window.location.href = 'signup.html'; return; }
    try {
      await api.addToCart(productId);
      showToast('Added to cart!');
    } catch (err) { alert('Error: ' + err.message); }
  }

  const wish = e.target.closest('.wish-link');
  if (wish) {
    e.preventDefault();
    const productId = parseInt(wish.dataset.id);
    const user = await checkAuth();
    if (!user) { window.location.href = 'signup.html'; return; }
    try {
      await api.addToWishlist(productId);
      showToast('Added to wishlist!');
    } catch (err) { alert('Error: ' + err.message); }
  }
});

function showToast(msg) {
  const t = document.getElementById('cart-toast') || (() => {
    const el = document.createElement('div'); el.id = 'cart-toast'; el.className = 'cart-toast';
    document.body.appendChild(el); return el;
  })();
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ─── Single Product ───────────────────────────────────
async function loadSingleProduct() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return;
  try {
    const d = await api.getProduct(id);
    const p = d.product;
    if (!p) return;
    document.getElementById('MainImg').src = p.image || 'img/button.png';
    document.querySelector('.single-pro-details h4').textContent = p.category || 'Figure';
    document.querySelector('.single-pro-details h2').textContent = '€' + parseFloat(p.price).toFixed(2);
    document.querySelector('.single-pro-details h6').textContent = 'Home / ' + (p.category || 'Figures');
    document.querySelector('.single-pro-details span').textContent = p.description || 'No description available.';
    const qtyInput = document.querySelector('.single-pro-details input[type="number"]');
    const addBtn = document.querySelector('.single-pro-details .normal');
    if (addBtn) {
      addBtn.onclick = async () => {
        const user = await checkAuth();
        if (!user) { window.location.href = 'signup.html'; return; }
        try { await api.addToCart(p.id, parseInt(qtyInput?.value) || 1); showToast('Added to cart!'); }
        catch (err) { alert('Error: ' + err.message); }
      };
    }
    const smallImgs = document.querySelectorAll('.small-img');
    if (smallImgs.length > 0) {
      smallImgs[0].src = p.image || 'img/button.png';
      smallImgs[0].onclick = function () { document.getElementById('MainImg').src = this.src; };
      for (let i = 1; i < smallImgs.length; i++) {
        smallImgs[i].src = 'img/products/f' + (i + 1) + '.jpg';
        smallImgs[i].onclick = function () { document.getElementById('MainImg').src = this.src; };
      }
    }
    loadProducts();
  } catch (err) { console.error(err); }
}

// ─── Cart Page ────────────────────────────────────────
async function loadCartPage() {
  const user = await checkAuth();
  const tbody = document.querySelector('#cart tbody');
  const subtotalEl = document.querySelector('#subtotal table');
  const totalEl = document.querySelector('#subtotal table tr:last-child td:last-child');

  if (!user) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">Please <a href="signup.html">sign in</a> to view your cart.</td></tr>';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'true') {
    try {
      await api.createOrder(selectedShipping);
      showToast('Payment successful! Order placed.');
    } catch (e) {}
    window.history.replaceState({}, '', 'cart.html');
  }

  try {
    const d = await api.getCart();
    const items = d.items || [];

    if (!items.length) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">Your cart is empty.</td></tr>';
      updateTotals(0, subtotalEl, totalEl);
      return;
    }

    if (tbody) {
      tbody.innerHTML = items.map(p => `<tr>
        <td><i class="fa-regular fa-circle-xmark remove-item" data-itemid="${p.id}"></i></td>
        <td><img src="${p.image || 'img/button.png'}" alt="${p.name}" style="width:80px"></td>
        <td>${p.name}</td>
        <td>€${parseFloat(p.price).toFixed(2)}</td>
        <td><input type="number" class="cart-qty" data-itemid="${p.id}" value="${p.quantity}" min="1"></td>
        <td>€${(parseFloat(p.price) * p.quantity).toFixed(2)}</td>
      </tr>`).join('');
    }

    const sub = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
    updateTotals(sub, subtotalEl, totalEl);

    tbody?.querySelectorAll('.remove-item').forEach(el => {
      el.addEventListener('click', async () => {
        try { await api.removeCartItem(parseInt(el.dataset.itemid)); loadCartPage(); }
        catch (err) { alert(err.message); }
      });
    });
    tbody?.querySelectorAll('.cart-qty').forEach(input => {
      input.addEventListener('change', async () => {
        const qty = parseInt(input.value);
        if (qty < 1) { input.value = 1; return; }
        try { await api.updateCartItem(parseInt(input.dataset.itemid), qty); loadCartPage(); }
        catch (err) { alert(err.message); }
      });
    });
  } catch (err) { console.error(err); }
}

function getShippingCost() {
  const opt = shippingOptions.find(o => o.id === selectedShipping);
  return opt ? opt.cost : 4.00;
}

function updateTotals(subtotal, subtotalEl, totalEl) {
  if (!subtotalEl) return;
  const shipping = getShippingCost();
  const rows = subtotalEl.querySelectorAll('tr');
  if (rows.length >= 3) {
    rows[0].querySelector('td:last-child').textContent = '€' + subtotal.toFixed(2);
    rows[1].querySelector('td:last-child').textContent = '€' + shipping.toFixed(2);
    rows[2].querySelector('td:last-child').textContent = '€' + (subtotal + shipping).toFixed(2);
  }
}

// ─── Wishlist Page ────────────────────────────────────
async function loadWishlistPage() {
  const user = await checkAuth();
  const container = document.getElementById('wishlist-container');
  if (!container) return;
  if (!user) { container.innerHTML = '<p style="text-align:center;width:100%;padding:40px">Please <a href="signup.html">sign in</a> to view your wishlist.</p>'; return; }
  try {
    const d = await api.getWishlist();
    const items = d.items || [];
    if (!items.length) { container.innerHTML = '<p style="text-align:center;width:100%;padding:40px">Your wishlist is empty.</p>'; return; }
    container.innerHTML = items.map(p => `<div class="pro">
      <div class="img-container" style="position:relative">
        <img src="${p.image || 'img/button.png'}" alt="${p.name}" onclick="window.location.href='sproduct.html?id=${p.product_id}'" style="cursor:pointer">
        <button class="wishlist-remove-btn" data-wishid="${p.product_id}" title="Remove from wishlist" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:50px;height:50px;background:#e74c3c;border:2px solid #e74c3c;border-radius:50%;opacity:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10">
          <i class="fa-solid fa-trash" style="color:white;font-size:20px;pointer-events:none"></i>
        </button>
      </div>
      <div class="des">
        <span>Wishlist</span>
        <h5 onclick="window.location.href='sproduct.html?id=${p.product_id}'" style="cursor:pointer">${p.name}</h5>
        <div class="star"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
        <h4>€${parseFloat(p.price).toFixed(2)}</h4>
      </div>
      <a href="#" class="cart-link" data-id="${p.product_id}"><i class="fa-solid fa-cart-plus cart"></i></a>
    </div>`).join('');
    container.querySelectorAll('[data-wishid]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try { await api.removeFromWishlist(parseInt(btn.dataset.wishid)); loadWishlistPage(); }
        catch (err) { alert(err.message); }
      });
    });
  } catch (err) { console.error(err); }
}

// ─── Orders Page ──────────────────────────────────────
async function loadOrdersPage() {
  const user = await checkAuth();
  const container = document.getElementById('orders-list');
  if (!container) return;
  if (!user) { container.innerHTML = '<p style="text-align:center;padding:40px">Please <a href="signup.html">sign in</a> to view your orders.</p>'; return; }
  try {
    const d = await api.getOrders();
    const orders = d.orders || [];
    if (!orders.length) { container.innerHTML = '<p style="text-align:center;padding:40px">No orders yet.</p>'; return; }
    container.innerHTML = orders.map(o => `<div class="order-card">
      <div class="order-header"><strong>${o.order_code}</strong> <span class="order-status ${o.status}">${o.status}</span></div>
      <div class="order-body">
        <p>${o.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</p>
        <p><strong>Total:</strong> €${o.total.toFixed(2)} | <strong>Date:</strong> ${new Date(o.created_at).toLocaleDateString()}</p>
      </div>
    </div>`).join('');
  } catch (err) { console.error(err); }
}

// ─── Checkout (Stripe) ────────────────────────────────
async function handleCheckout() {
  const user = await checkAuth();
  if (!user) { window.location.href = 'signup.html'; return; }
  try {
    const d = await api.createCheckoutSession(selectedShipping);
    if (d.url) window.location.href = d.url;
  } catch (err) { alert('Error: ' + err.message); }
}

// ─── Newsletter ───────────────────────────────────────
function initNewsletter() {
  const forms = document.querySelectorAll('.newsletter-form');
  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"], input[type="text"]');
      const nameInput = form.querySelector('input[name="newsletter-name"]');
      const email = emailInput?.value.trim();
      const username = nameInput?.value.trim();
      if (!email) { alert('Please enter your email'); return; }
      try {
        await api.subscribeNewsletter(email, username);
        alert('Subscribed to newsletter!');
        if (emailInput) emailInput.value = '';
        if (nameInput) nameInput.value = '';
      } catch (err) { alert(err.message); }
    });
  });
}

// ─── Dashboard ────────────────────────────────────────
async function loadDashboard() {
  if (!isAdminMode()) { window.location.href = 'index.html'; return; }
  try {
    const d = await api.getAdminStats();
    const stats = d.stats;
    document.getElementById('stat-revenue').textContent = '€' + (stats.totalRevenue || 0).toFixed(2);
    document.getElementById('stat-orders').textContent = stats.totalOrders || 0;
    document.getElementById('stat-products').textContent = stats.totalProducts || 0;

    const months = Object.entries(stats.monthlyRevenue || {});
    const chart = document.getElementById('revenue-chart');
    if (chart) {
      const max = Math.max(...months.map(([, v]) => v), 1);
      chart.innerHTML = months.map(([k, v]) => {
        const pct = (v / max) * 100;
        return `<div class="chart-bar"><div class="bar" style="height:${Math.max(pct, 2)}%"></div><span>${k.split('-')[1]}</span><span class="bar-val">€${v.toFixed(0)}</span></div>`;
      }).join('');
    }

    const recent = document.getElementById('recent-orders');
    if (recent) {
      const orders = d.orders || [];
      if (!orders.length) recent.innerHTML = '<p>No orders yet.</p>';
      else recent.innerHTML = orders.map(o => `<div class="order-card"><div class="order-header"><strong>${o.order_code}</strong> by ${o.username} <span class="order-status ${o.status}">${o.status}</span></div><div class="order-body">€${o.total.toFixed(2)} - ${new Date(o.created_at).toLocaleDateString()}</div></div>`).join('');
    }

    const subsEl = document.getElementById('stat-subs');
    if (subsEl) {
      try {
        const subData = await api.getNewsletterSubscribers();
        subsEl.textContent = (subData.subscribers || []).length;
      } catch (e) { subsEl.textContent = '0'; }
    }
  } catch (err) { console.error('Dashboard error:', err); }
}

async function loadDashboardOrders() {
  try {
    const d = await api.getAdminOrders();
    const orders = d.orders || [];
    const tbody = document.querySelector('#orders-table tbody');
    if (!tbody) return;
    if (!orders.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px">No orders</td></tr>'; return; }
    tbody.innerHTML = orders.map(o => `<tr>
      <td><strong>${o.order_code}</strong></td>
      <td>${o.username}</td>
      <td>${o.items.map(i => i.name).join(', ')}</td>
      <td>€${o.total.toFixed(2)}</td>
      <td><span class="order-status ${o.status}">${o.status}</span></td>
      <td>${new Date(o.created_at).toLocaleString()}</td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
}

async function loadDashboardProducts() {
  try {
    const d = await api.getProducts();
    const products = d.products || [];
    const tbody = document.querySelector('#products-table tbody');
    if (!tbody) return;
    tbody.innerHTML = products.map(p => `<tr>
      <td><img src="${p.image || 'img/button.png'}" style="width:50px;height:50px;object-fit:cover;border-radius:8px"></td>
      <td>${p.name}</td>
      <td>€${parseFloat(p.price).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${p.category || 'Figure'}</td>
      <td>
        <button class="edit-btn" style="opacity:1;position:static;display:inline-block;width:auto;height:auto;padding:4px 10px;border-radius:4px;margin-right:5px" data-pid="${p.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn" style="opacity:1;position:static;display:inline-block;width:auto;height:auto;padding:4px 10px;border-radius:4px" data-pid="${p.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
    tbody.querySelectorAll('.edit-btn[data-pid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { const d2 = await api.getProduct(parseInt(btn.dataset.pid)); showEditModal(d2.product); }
        catch (err) { alert(err.message); }
      });
    });
    tbody.querySelectorAll('.delete-btn[data-pid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this product?')) {
          try { await api.deleteProduct(parseInt(btn.dataset.pid)); loadDashboardProducts(); }
          catch (err) { alert(err.message); }
        }
      });
    });
  } catch (err) { console.error(err); }
}

async function loadDashboardNewsletter() {
  try {
    const d = await api.getNewsletterSubscribers();
    const subs = d.subscribers || [];
    const tbody = document.querySelector('#newsletter-table tbody');
    if (!tbody) return;
    if (!subs.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:30px">No subscribers yet.</td></tr>';
      return;
    }
    tbody.innerHTML = subs.map(s => `<tr>
      <td>${escapeHtml(s.username || '-')}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${new Date(s.subscribed_at).toLocaleString()}</td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Send Newsletter Modal ────────────────────────────
function createNewsletterModal() {
  if (document.getElementById('newsletter-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'newsletter-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px">
      <span class="modal-close" onclick="this.closest('.modal-overlay').style.display='none'">&times;</span>
      <h2>Send Newsletter</h2>
      <form id="newsletter-send-form">
        <div class="form-group"><label for="newsletter-subject">Subject *</label><input type="text" id="newsletter-subject" required placeholder="Email subject"></div>
        <div class="form-group"><label for="newsletter-message">Message *</label><textarea id="newsletter-message" rows="8" required placeholder="Write your message..." style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;font-family:inherit"></textarea></div>
        <button type="submit" class="modal-submit">Send to All Subscribers</button>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  document.getElementById('newsletter-send-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('newsletter-subject').value;
    const message = document.getElementById('newsletter-message').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
      const res = await api.sendNewsletter(subject, message);
      alert(`Newsletter sent to ${res.sent} subscribers!`);
      modal.style.display = 'none';
      e.target.reset();
    } catch (err) { alert('Error: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = 'Send to All Subscribers'; }
  });
}

function showNewsletterModal() {
  createNewsletterModal();
  document.getElementById('newsletter-modal').style.display = 'flex';
}

// ─── Chat / Contact Modal ─────────────────────────────
function createContactModal() {
  if (document.getElementById('contact-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'contact-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px">
      <span class="modal-close" onclick="this.closest('.modal-overlay').style.display='none'">&times;</span>
      <h2>Contact Me</h2>
      <p style="color:#666;margin-bottom:20px">Have a problem? Send me a message and I'll get back to you.</p>
      <form id="contact-form">
        <div class="form-group"><label for="contact-name">Your Name *</label><input type="text" id="contact-name" required placeholder="Your name"></div>
        <div class="form-group"><label for="contact-email">Your Email *</label><input type="email" id="contact-email" required placeholder="your@email.com"></div>
        <div class="form-group"><label for="contact-subject">Subject *</label>
          <select id="contact-subject" required style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px">
            <option value="">-- Select a problem --</option>
            <option value="Order Issue">Order Issue</option>
            <option value="Product Defect / Damage">Product Defect / Damage</option>
            <option value="Shipping Delay">Shipping Delay</option>
            <option value="Wrong Item Received">Wrong Item Received</option>
            <option value="Return / Refund Request">Return / Refund Request</option>
            <option value="Payment Problem">Payment Problem</option>
            <option value="Account Issue">Account Issue</option>
            <option value="Custom Order Request">Custom Order Request</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group"><label for="contact-message">Message *</label><textarea id="contact-message" rows="6" required placeholder="Describe your problem in detail..." style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;font-family:inherit"></textarea></div>
        <button type="submit" class="modal-submit">Send Message</button>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('contact-name').value;
    const email = document.getElementById('contact-email').value;
    const subject = document.getElementById('contact-subject').value;
    const message = document.getElementById('contact-message').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
      await api.sendContactMessage(name, email, subject, message);
      alert('Message sent! I will get back to you soon.');
      modal.style.display = 'none';
      e.target.reset();
    } catch (err) { alert('Error: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = 'Send Message'; }
  });
}

function showContactModal() {
  createContactModal();
  document.getElementById('contact-modal').style.display = 'flex';
  checkAuth().then(user => {
    if (user) {
      if (document.getElementById('contact-name') && !document.getElementById('contact-name').value) {
        document.getElementById('contact-name').value = user.username || '';
      }
      if (document.getElementById('contact-email') && !document.getElementById('contact-email').value) {
        document.getElementById('contact-email').value = user.email || '';
      }
    }
  });
}

// ─── Dashboard Tab Switching ──────────────────────────
function initDashboard() {
  document.querySelectorAll('.dash-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.dash-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById('dash-' + tab.dataset.tab);
      if (target) target.classList.add('active');
      if (tab.dataset.tab === 'overview') loadDashboard();
      if (tab.dataset.tab === 'orders') loadDashboardOrders();
      if (tab.dataset.tab === 'products') loadDashboardProducts();
      if (tab.dataset.tab === 'newsletter') loadDashboardNewsletter();
    });
  });
  loadDashboard();
  loadDashboardOrders();
}

// ─── Signup ───────────────────────────────────────────
function initSignupPage() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegister = document.getElementById('show-register');
  const showLogin = document.getElementById('show-login');
  const formTitle = document.getElementById('form-title');

  if (showRegister) {
    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
      if (formTitle) formTitle.textContent = 'Create Account';
    });
  }
  if (showLogin) {
    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      if (registerForm) registerForm.style.display = 'none';
      if (loginForm) loginForm.style.display = 'block';
      if (formTitle) formTitle.textContent = 'Sign In';
    });
  }
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value;
      const password = document.getElementById('login-password')?.value;
      if (!email || !password) { alert('Please fill in all fields'); return; }
      try { 
        await api.login(email, password); 
        window.location.href = 'index.html'; 
      } catch (err) { 
        alert(err.message); 
      }
    });
  }
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username')?.value;
      const email = document.getElementById('reg-email')?.value;
      const password = document.getElementById('reg-password')?.value;
      const confirm = document.getElementById('reg-confirm')?.value;
      if (password !== confirm) { alert('Passwords do not match'); return; }
      try {
        await api.register(username, email, password);
        window.location.href = 'index.html';
      } catch (err) { alert(err.message); }
    });
  }
}

// ─── Shipping Options in Cart ────────────────────────
async function loadShippingOptions() {
  try {
    const d = await api.getShippingOptions();
    shippingOptions = d.options || [];
    if (shippingOptions.length > 0) selectedShipping = shippingOptions[0].id;
    renderShippingOptions();
  } catch (err) { console.error('Failed to load shipping:', err); }
}

function renderShippingOptions() {
  const container = document.getElementById('shipping-options');
  if (!container) return;
  container.innerHTML = shippingOptions.map(o => `
    <label class="shipping-option" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px solid #eee">
      <input type="radio" name="shipping" value="${o.id}" ${o.id === selectedShipping ? 'checked' : ''} onchange="selectedShipping=this.value;updateCartShipping()">
      <div>
        <strong>${o.name}</strong>
        <span style="color:#666;font-size:13px;margin-left:8px">€${o.cost.toFixed(2)}</span>
        <span style="color:#999;font-size:12px;margin-left:8px">${o.eta}</span>
      </div>
    </label>
  `).join('');
}

function updateCartShipping() {
  const subtotalEl = document.querySelector('#subtotal table');
  const totalEl = document.querySelector('#subtotal table tr:last-child td:last-child');
  const subtotal = parseFloat(subtotalEl?.querySelector('tr:first-child td:last-child')?.textContent?.replace('€', '') || '0');
  updateTotals(subtotal, subtotalEl, totalEl);
}

// ─── Admin Panel Button & Chat Button in Nav ─────────
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('navbar');
  if (nav) {
    const authLink = document.getElementById('auth-link');
    
    const chatLi = document.createElement('li');
    chatLi.innerHTML = '<a href="#" id="chat-nav-btn" style="color:#088178;font-weight:600"><i class="fa-regular fa-message"></i> Chat</a>';
    if (authLink) authLink.parentNode.insertBefore(chatLi, authLink);
    document.getElementById('chat-nav-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      showContactModal();
    });

    const adminLi = document.createElement('li');
    adminLi.id = 'admin-nav-item';
    adminLi.innerHTML = '<a href="#" id="admin-panel-btn" style="color:#088178;font-weight:700">Admin</a>';
    if (authLink) authLink.parentNode.insertBefore(adminLi, authLink);
    document.getElementById('admin-panel-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (isAdminMode()) {
        if (window.location.pathname.includes('dashboard.html')) showAdminModal();
        else window.location.href = 'dashboard.html';
      }
    });
    if (!isAdminMode()) adminLi.style.display = 'none';
    else adminLi.style.display = '';
  }
});

// ─── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const user = await checkAuth();
  updateNavbar(user);

  const bar = document.getElementById('bar');
  const close = document.getElementById('close');
  const nav = document.getElementById('navbar');
  if (bar) bar.addEventListener('click', () => nav?.classList.add('active'));
  if (close) close.addEventListener('click', () => nav?.classList.remove('active'));

  if (['index.html', '', '/'].includes(page)) loadProducts();
  if (page === 'shop.html') loadProducts();
  if (page === 'cart.html') { loadCartPage(); initNewsletter(); loadShippingOptions(); }
  if (page === 'sproduct.html') loadSingleProduct();
  if (page === 'signup.html') initSignupPage();
  if (page === 'wishlist.html') loadWishlistPage();
  if (page === 'orders.html') loadOrdersPage();
  if (page === 'dashboard.html') { initDashboard(); }

  initNewsletter();

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);
});
