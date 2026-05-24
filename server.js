require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const SHIPPING_COST = 4.00;

// ─── Database ───────────────────────────────────────────────
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  const seedProducts = [
    { name: 'Nurse Silent Hill', description: 'A detailed 3D printed figure of the iconic Nurse from Silent Hill.', price: 19.99, stock: 10, category: 'Figure', image: '/img/products/f1.jpg' },
    { name: 'Freddy Cosplay Mask', description: 'High-quality 3D printed Freddy Krueger cosplay mask.', price: 44.99, stock: 5, category: 'Cosplay', image: '/img/products/f2.jpg' },
    { name: 'Jax TADC', description: '3D printed figure of Jax from The Amazing Digital Circus.', price: 19.99, stock: 10, category: 'Figure', image: '/img/products/f3.jpg' },
    { name: 'Venom', description: 'Detailed Venom figure, 3D printed and hand-painted.', price: 24.99, stock: 8, category: 'Figure', image: '/img/products/f4.jpg' },
    { name: 'Gojo Saturo JJK', description: 'Figure of Gojo Satoru from Jujutsu Kaisen.', price: 23.99, stock: 7, category: 'Figure', image: '/img/products/f5.jpg' },
    { name: 'Prototype Mask', description: 'Mysterious prototype cosplay mask, 3D printed.', price: 29.99, stock: 4, category: 'Cosplay', image: '/img/products/f7.jpg' },
    { name: 'Alastor Hazbin Hotel', description: 'Alastor the Radio Demon figure from Hazbin Hotel.', price: 19.99, stock: 6, category: 'Figure', image: '/img/products/f6.jpg' },
    { name: 'Hornet Silksong', description: 'Hornet figure from Hollow Knight Silksong.', price: 19.99, stock: 9, category: 'Figure', image: '/img/products/f8.jpg' },
    { name: 'Chica Mask (WIP)', description: 'Work in progress Chica cosplay mask from Five Nights at Freddys.', price: 39.99, stock: 3, category: 'Cosplay', image: '/img/products/n1.jpg' },
    { name: 'Baby Yoda', description: 'Cute Baby Yoda (Grogu) 3D printed figure.', price: 7.99, stock: 15, category: 'Figure', image: '/img/products/n2.jpg' },
    { name: 'Hollow Knight Headphone Stand', description: 'Functional headphone stand shaped like the Hollow Knight.', price: 14.99, stock: 12, category: 'Stand', image: '/img/products/n3.jpg' },
    { name: 'Ichigo Hollow Mask *PINK*', description: 'Ichigo Hollow mask from Bleach in pink color.', price: 15.99, stock: 8, category: 'Cosplay', image: '/img/products/n4.jpg' },
    { name: 'Geisha', description: 'Elegant Geisha 3D printed figure.', price: 19.99, stock: 5, category: 'Figure', image: '/img/products/n5.jpg' },
    { name: 'Toji Fushiguro', description: 'Toji Fushiguro figure from Jujutsu Kaisen.', price: 49.99, stock: 4, category: 'Figure', image: '/img/products/n6.jpg' },
    { name: 'Luffy Gear 5', description: 'Monkey D. Luffy Gear 5 figure from One Piece.', price: 39.99, stock: 6, category: 'Figure', image: '/img/products/f6.jpg' },
    { name: 'Avatar Fire & Ash', description: 'Figure inspired by Avatar Fire and Ash.', price: 19.99, stock: 7, category: 'Figure', image: '/img/products/n8.jpg' }
  ];
  const data = {
    users: [], products: [], cartItems: [], orders: [], newsletters: [], wishlistItems: [],
    nextId: { users: 1, products: 1, cartItems: 1, orders: 1, newsletters: 1, wishlistItems: 1 }
  };
  for (const p of seedProducts) {
    data.products.push({ id: data.nextId.products++, ...p, created_at: new Date().toISOString() });
  }
  saveData(data);
  return data;
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
let db = loadData();

// ─── Helpers ────────────────────────────────────────────────
function getUser(id) { return db.users.find(u => u.id === id); }
function getUserByEmail(email) { return db.users.find(u => u.email === email); }
function getProduct(id) { return db.products.find(p => p.id === id); }

// ─── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); }
});
const upload = multer({ storage });

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

// ─── Auth ───────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (getUserByEmail(email)) return res.status(400).json({ error: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const isAdmin = db.users.length === 0 ? 1 : 0;
    const user = { id: db.nextId.users++, username, email, password: hashedPassword, is_admin: isAdmin, created_at: new Date().toISOString() };
    db.users.push(user);
    saveData(db);
    req.session.userId = user.id;
    req.session.isAdmin = isAdmin;
    res.json({ user: { id: user.id, username, email, is_admin: isAdmin } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields required' });
    const user = getUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid email or password' });
    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin;
    res.json({ user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = getUser(req.session.userId);
  res.json({ user: user ? { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin } : null });
});

// ─── Products ──────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const products = [...db.products].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ products });
});

app.get('/api/products/:id', (req, res) => {
  const product = getProduct(parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

app.post('/api/products', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
    const image = req.file ? '/uploads/' + req.file.filename : null;
    const product = { id: db.nextId.products++, name, description: description || '', price: parseFloat(price), stock: parseInt(stock) || 0, category: category || 'Figure', image, created_at: new Date().toISOString() };
    db.products.push(product);
    saveData(db);
    res.json({ product });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const product = getProduct(parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const { name, description, price, stock, category } = req.body;
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = parseFloat(price);
    if (stock !== undefined) product.stock = parseInt(stock);
    if (category !== undefined) product.category = category;
    if (req.file) product.image = '/uploads/' + req.file.filename;
    product.updated_at = new Date().toISOString();
    saveData(db);
    res.json({ product });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = db.products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  db.products.splice(idx, 1);
  db.cartItems = db.cartItems.filter(ci => ci.product_id !== id);
  db.wishlistItems = db.wishlistItems.filter(wi => wi.product_id !== id);
  saveData(db);
  res.json({ success: true });
});

// ─── Cart ───────────────────────────────────────────────────
app.get('/api/cart', requireAuth, (req, res) => {
  const items = db.cartItems.filter(ci => ci.user_id === req.session.userId).map(ci => {
    const p = getProduct(ci.product_id);
    return p ? { id: ci.id, quantity: ci.quantity, product_id: ci.product_id, name: p.name, price: p.price, image: p.image, stock: p.stock } : null;
  }).filter(Boolean);
  res.json({ items });
});

app.post('/api/cart', requireAuth, (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });
    if (!getProduct(product_id)) return res.status(404).json({ error: 'Product not found' });
    const existing = db.cartItems.find(ci => ci.user_id === req.session.userId && ci.product_id === product_id);
    if (existing) existing.quantity += quantity;
    else db.cartItems.push({ id: db.nextId.cartItems++, user_id: req.session.userId, product_id, quantity });
    saveData(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/cart/:id', requireAuth, (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) return res.status(400).json({ error: 'Invalid quantity' });
    const item = db.cartItems.find(ci => ci.id === parseInt(req.params.id) && ci.user_id === req.session.userId);
    if (!item) return res.status(404).json({ error: 'Cart item not found' });
    item.quantity = quantity;
    saveData(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/cart/:id', requireAuth, (req, res) => {
  try {
    const idx = db.cartItems.findIndex(ci => ci.id === parseInt(req.params.id) && ci.user_id === req.session.userId);
    if (idx === -1) return res.status(404).json({ error: 'Cart item not found' });
    db.cartItems.splice(idx, 1);
    saveData(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Wishlist ──────────────────────────────────────────────
app.get('/api/wishlist', requireAuth, (req, res) => {
  const items = db.wishlistItems.filter(wi => wi.user_id === req.session.userId).map(wi => {
    const p = getProduct(wi.product_id);
    return p ? { id: wi.id, product_id: wi.product_id, name: p.name, price: p.price, image: p.image } : null;
  }).filter(Boolean);
  res.json({ items });
});

app.post('/api/wishlist', requireAuth, (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });
    if (!getProduct(product_id)) return res.status(404).json({ error: 'Product not found' });
    const existing = db.wishlistItems.find(wi => wi.user_id === req.session.userId && wi.product_id === product_id);
    if (existing) return res.json({ success: true, message: 'Already in wishlist' });
    db.wishlistItems.push({ id: db.nextId.wishlistItems++, user_id: req.session.userId, product_id, created_at: new Date().toISOString() });
    saveData(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/wishlist/:productId', requireAuth, (req, res) => {
  try {
    const pid = parseInt(req.params.productId);
    const idx = db.wishlistItems.findIndex(wi => wi.user_id === req.session.userId && wi.product_id === pid);
    if (idx === -1) return res.status(404).json({ error: 'Not in wishlist' });
    db.wishlistItems.splice(idx, 1);
    saveData(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Orders & Stripe ───────────────────────────────────────
app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const cartItems = db.cartItems.filter(ci => ci.user_id === req.session.userId);
    if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    const lineItems = cartItems.map(ci => {
      const p = getProduct(ci.product_id);
      if (!p) return null;
      return {
        price_data: { currency: 'eur', product_data: { name: p.name, images: p.image ? [`${req.headers.origin}${p.image}`] : [] }, unit_amount: Math.round(p.price * 100) },
        quantity: ci.quantity,
      };
    }).filter(Boolean);

    lineItems.push({
      price_data: { currency: 'eur', product_data: { name: 'Shipping' }, unit_amount: Math.round(SHIPPING_COST * 100) },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `${req.headers.origin}/cart.html?success=true`,
      cancel_url: `${req.headers.origin}/cart.html?canceled=true`,
      metadata: { user_id: req.session.userId.toString() },
    });
    res.json({ url: session.url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/create-order', requireAuth, (req, res) => {
  try {
    const cartItems = db.cartItems.filter(ci => ci.user_id === req.session.userId);
    if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    const user = getUser(req.session.userId);
    const now = new Date();
    const orderCode = 'JJ3D-' + now.getFullYear() + now.getMonth().toString().padStart(2,'0') + now.getDate().toString().padStart(2,'0') + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const subtotal = cartItems.reduce((sum, ci) => {
      const p = getProduct(ci.product_id);
      return sum + (p ? p.price * ci.quantity : 0);
    }, 0);

    const order = {
      id: db.nextId.orders++,
      user_id: req.session.userId,
      username: user ? user.username : 'Unknown',
      order_code: orderCode,
      subtotal: Math.round(subtotal * 100) / 100,
      shipping: SHIPPING_COST,
      total: Math.round((subtotal + SHIPPING_COST) * 100) / 100,
      status: 'paid',
      items: cartItems.map(ci => {
        const p = getProduct(ci.product_id);
        return { product_id: ci.product_id, name: p ? p.name : 'Unknown', quantity: ci.quantity, price: p ? p.price : 0 };
      }),
      created_at: now.toISOString()
    };

    db.orders.push(order);
    db.cartItems = db.cartItems.filter(ci => ci.user_id !== req.session.userId);
    saveData(db);
    res.json({ order });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders', requireAuth, (req, res) => {
  const orders = db.orders.filter(o => o.user_id === req.session.userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ orders });
});

app.get('/api/orders/:code', requireAuth, (req, res) => {
  const order = db.orders.find(o => o.order_code === req.params.code && o.user_id === req.session.userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

// ─── Admin Dashboard ───────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  const monthlyRevenue = {};
  for (let m = 0; m < 12; m++) {
    monthlyRevenue[`${thisYear}-${String(m + 1).padStart(2, '0')}`] = 0;
  }

  let totalRevenue = 0;
  let totalOrders = 0;
  let totalProducts = db.products.length;

  db.orders.forEach(o => {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyRevenue[key] !== undefined) monthlyRevenue[key] += o.total;
    if (d.getFullYear() === thisYear) totalRevenue += o.total;
    totalOrders++;
  });

  const recentOrders = [...db.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
  const recentOrdersWithUser = recentOrders.map(o => ({
    ...o,
    username: (getUser(o.user_id) || {}).username || 'Unknown'
  }));

  res.json({
    stats: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      totalProducts,
      monthlyRevenue,
    },
    orders: recentOrdersWithUser,
  });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const allOrders = [...db.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(o => ({
    ...o,
    username: (getUser(o.user_id) || {}).username || 'Unknown'
  }));
  res.json({ orders: allOrders });
});

// ─── Newsletter ────────────────────────────────────────────
app.post('/api/newsletter', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const existing = db.newsletters.find(n => n.email === email);
    if (existing) return res.json({ success: true, message: 'Already subscribed' });
    db.newsletters.push({ id: db.nextId.newsletters++, email, subscribed_at: new Date().toISOString() });
    saveData(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Stripe Webhook (optional, for production) ────────────
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = parseInt(session.metadata.user_id);
    if (userId) {
      req.session = { userId };
    }
  }
  res.json({ received: true });
});

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`JJ's 3D Shop running on http://localhost:${PORT}`);
  console.log(`Shipping: €${SHIPPING_COST.toFixed(2)}`);
  console.log('Stripe ready (set STRIPE_SECRET_KEY in .env)');
});
