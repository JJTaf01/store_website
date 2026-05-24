require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const fs = require('fs');
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;
const SHIPPING_COST = 4.00;

// ─── Webhook (must be before json parser to get raw body) ──
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
  }
  res.json({ received: true });
});

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

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const isAdmin = count === 0 ? 1 : 0;

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase.from('users').insert({
      username, email, password: hashedPassword, is_admin: isAdmin
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    req.session.userId = user.id;
    req.session.isAdmin = isAdmin;
    res.json({ user: { id: user.id, username, email, is_admin: isAdmin } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields required' });

    const { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid email or password' });

    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin;
    res.json({ user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const { data: user } = await supabase.from('users').select('*').eq('id', req.session.userId).maybeSingle();
  res.json({ user: user ? { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin } : null });
});

// ─── Products ──────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  const { data: products, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ products: products || [] });
});

app.get('/api/products/:id', async (req, res) => {
  const { data: product } = await supabase.from('products').select('*').eq('id', parseInt(req.params.id)).maybeSingle();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

app.post('/api/products', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
    const image = req.file ? '/uploads/' + req.file.filename : null;

    const { data: product, error } = await supabase.from('products').insert({
      name, description: description || '', price: parseFloat(price),
      stock: parseInt(stock) || 0, category: category || 'Figure', image
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ product });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { data: product } = await supabase.from('products').select('*').eq('id', parseInt(req.params.id)).maybeSingle();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const updates = {};
    const { name, description, price, stock, category } = req.body;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseFloat(price);
    if (stock !== undefined) updates.stock = parseInt(stock);
    if (category !== undefined) updates.category = category;
    if (req.file) updates.image = '/uploads/' + req.file.filename;
    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase.from('products').update(updates).eq('id', parseInt(req.params.id)).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ product: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await supabase.from('cart_items').delete().eq('product_id', id);
    await supabase.from('wishlist_items').delete().eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Cart ───────────────────────────────────────────────────
app.get('/api/cart', requireAuth, async (req, res) => {
  const { data: items, error } = await supabase
    .from('cart_items')
    .select('*, products(*)')
    .eq('user_id', req.session.userId);

  if (error) return res.status(500).json({ error: error.message });

  const mapped = (items || []).map(ci => ({
    id: ci.id, quantity: ci.quantity, product_id: ci.product_id,
    name: ci.products?.name, price: ci.products?.price,
    image: ci.products?.image, stock: ci.products?.stock
  })).filter(i => i.name);

  res.json({ items: mapped });
});

app.post('/api/cart', requireAuth, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });

    const { data: product } = await supabase.from('products').select('id').eq('id', product_id).maybeSingle();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { data: existing } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', req.session.userId)
      .eq('product_id', product_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase
        .from('cart_items')
        .insert({ user_id: req.session.userId, product_id, quantity });
      if (error) return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/cart/:id', requireAuth, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) return res.status(400).json({ error: 'Invalid quantity' });

    const { data: item } = await supabase
      .from('cart_items')
      .select('*')
      .eq('id', parseInt(req.params.id))
      .eq('user_id', req.session.userId)
      .maybeSingle();

    if (!item) return res.status(404).json({ error: 'Cart item not found' });

    const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', item.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/cart/:id', requireAuth, async (req, res) => {
  try {
    const { data: item } = await supabase
      .from('cart_items')
      .select('*')
      .eq('id', parseInt(req.params.id))
      .eq('user_id', req.session.userId)
      .maybeSingle();

    if (!item) return res.status(404).json({ error: 'Cart item not found' });

    const { error } = await supabase.from('cart_items').delete().eq('id', item.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Wishlist ──────────────────────────────────────────────
app.get('/api/wishlist', requireAuth, async (req, res) => {
  const { data: items, error } = await supabase
    .from('wishlist_items')
    .select('*, products(*)')
    .eq('user_id', req.session.userId);

  if (error) return res.status(500).json({ error: error.message });

  const mapped = (items || []).map(wi => ({
    id: wi.id, product_id: wi.product_id,
    name: wi.products?.name, price: wi.products?.price, image: wi.products?.image
  })).filter(i => i.name);

  res.json({ items: mapped });
});

app.post('/api/wishlist', requireAuth, async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });

    const { data: product } = await supabase.from('products').select('id').eq('id', product_id).maybeSingle();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { data: existing } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('user_id', req.session.userId)
      .eq('product_id', product_id)
      .maybeSingle();

    if (existing) return res.json({ success: true, message: 'Already in wishlist' });

    const { error } = await supabase.from('wishlist_items').insert({
      user_id: req.session.userId, product_id
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/wishlist/:productId', requireAuth, async (req, res) => {
  try {
    const pid = parseInt(req.params.productId);
    const { data: existing } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('user_id', req.session.userId)
      .eq('product_id', pid)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: 'Not in wishlist' });

    const { error } = await supabase.from('wishlist_items').delete().eq('id', existing.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Orders & Stripe ───────────────────────────────────────
app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const { data: cartItems } = await supabase
      .from('cart_items')
      .select('*, products(*)')
      .eq('user_id', req.session.userId);

    if (!cartItems || cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    const lineItems = cartItems.map(ci => {
      const p = ci.products;
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

app.post('/api/create-order', requireAuth, async (req, res) => {
  try {
    const { data: cartItems } = await supabase
      .from('cart_items')
      .select('*, products(*)')
      .eq('user_id', req.session.userId);

    if (!cartItems || cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    const { data: user } = await supabase.from('users').select('username').eq('id', req.session.userId).single();
    const now = new Date();
    const orderCode = 'JJ3D-' + now.getFullYear() + now.getMonth().toString().padStart(2,'0') + now.getDate().toString().padStart(2,'0') + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const subtotal = cartItems.reduce((sum, ci) => {
      return sum + (ci.products ? ci.products.price * ci.quantity : 0);
    }, 0);

    const items = cartItems.map(ci => ({
      product_id: ci.product_id, name: ci.products?.name || 'Unknown',
      quantity: ci.quantity, price: ci.products?.price || 0
    }));

    const { data: order, error } = await supabase.from('orders').insert({
      user_id: req.session.userId, username: user?.username || 'Unknown',
      order_code: orderCode, subtotal: Math.round(subtotal * 100) / 100,
      shipping: SHIPPING_COST, total: Math.round((subtotal + SHIPPING_COST) * 100) / 100,
      status: 'paid', items
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('cart_items').delete().eq('user_id', req.session.userId);

    res.json({ order });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', req.session.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: orders || [] });
});

app.get('/api/orders/:code', requireAuth, async (req, res) => {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('order_code', req.params.code)
    .eq('user_id', req.session.userId)
    .maybeSingle();

  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

// ─── Admin Dashboard ───────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    const { data: allOrders } = await supabase.from('orders').select('*');
    const { data: users } = await supabase.from('users').select('id');
    const { data: products } = await supabase.from('products').select('id');

    const monthlyRevenue = {};
    for (let m = 0; m < 12; m++) {
      monthlyRevenue[`${thisYear}-${String(m + 1).padStart(2, '0')}`] = 0;
    }

    let totalRevenue = 0;
    let totalOrders = 0;
    let totalProducts = (products || []).length;

    (allOrders || []).forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyRevenue[key] !== undefined) monthlyRevenue[key] += o.total;
      if (d.getFullYear() === thisYear) totalRevenue += o.total;
      totalOrders++;
    });

    const recentOrders = [...(allOrders || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

    const { data: allUsers } = await supabase.from('users').select('id, username');
    const userMap = {};
    (allUsers || []).forEach(u => { userMap[u.id] = u.username; });

    const recentOrdersWithUser = recentOrders.map(o => ({
      ...o, username: userMap[o.user_id] || 'Unknown'
    }));

    res.json({
      stats: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders, totalProducts, monthlyRevenue,
      },
      orders: recentOrdersWithUser,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: users } = await supabase.from('users').select('id, username');
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u.username; });

  const withUser = (orders || []).map(o => ({ ...o, username: userMap[o.user_id] || 'Unknown' }));
  res.json({ orders: withUser });
});

// ─── Newsletter ────────────────────────────────────────────
app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const { data: existing } = await supabase.from('newsletters').select('*').eq('email', email).maybeSingle();
    if (existing) return res.json({ success: true, message: 'Already subscribed' });

    const { error } = await supabase.from('newsletters').insert({ email });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`JJ's 3D Shop running on http://localhost:${PORT}`);
  console.log(`Shipping: €${SHIPPING_COST.toFixed(2)}`);
  console.log('Stripe ready (set STRIPE_SECRET_KEY in .env)');
});
