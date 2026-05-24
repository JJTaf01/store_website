-- Create tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  verification_expires TIMESTAMPTZ,
  reset_token TEXT,
  reset_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0,
  category TEXT DEFAULT 'Figure',
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  order_code TEXT UNIQUE,
  subtotal DECIMAL(10,2),
  shipping DECIMAL(10,2),
  total DECIMAL(10,2),
  status TEXT DEFAULT 'paid',
  items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE newsletters (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wishlist_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed products
INSERT INTO products (name, description, price, stock, category, image) VALUES
('Nurse Silent Hill', 'A detailed 3D printed figure of the iconic Nurse from Silent Hill.', 19.99, 10, 'Figure', '/img/products/f1.jpg'),
('Freddy Cosplay Mask', 'High-quality 3D printed Freddy Krueger cosplay mask.', 44.99, 5, 'Cosplay', '/img/products/f2.jpg'),
('Jax TADC', '3D printed figure of Jax from The Amazing Digital Circus.', 19.99, 10, 'Figure', '/img/products/f3.jpg'),
('Venom', 'Detailed Venom figure, 3D printed and hand-painted.', 24.99, 8, 'Figure', '/img/products/f4.jpg'),
('Gojo Saturo JJK', 'Figure of Gojo Satoru from Jujutsu Kaisen.', 23.99, 7, 'Figure', '/img/products/f5.jpg'),
('Prototype Mask', 'Mysterious prototype cosplay mask, 3D printed.', 29.99, 4, 'Cosplay', '/img/products/f7.jpg'),
('Alastor Hazbin Hotel', 'Alastor the Radio Demon figure from Hazbin Hotel.', 19.99, 6, 'Figure', '/img/products/f6.jpg'),
('Hornet Silksong', 'Hornet figure from Hollow Knight Silksong.', 19.99, 9, 'Figure', '/img/products/f8.jpg'),
('Chica Mask (WIP)', 'Work in progress Chica cosplay mask from Five Nights at Freddys.', 39.99, 3, 'Cosplay', '/img/products/n1.jpg'),
('Baby Yoda', 'Cute Baby Yoda (Grogu) 3D printed figure.', 7.99, 15, 'Figure', '/img/products/n2.jpg'),
('Hollow Knight Headphone Stand', 'Functional headphone stand shaped like the Hollow Knight.', 14.99, 12, 'Stand', '/img/products/n3.jpg'),
('Ichigo Hollow Mask *PINK*', 'Ichigo Hollow mask from Bleach in pink color.', 15.99, 8, 'Cosplay', '/img/products/n4.jpg'),
('Geisha', 'Elegant Geisha 3D printed figure.', 19.99, 5, 'Figure', '/img/products/n5.jpg'),
('Toji Fushiguro', 'Toji Fushiguro figure from Jujutsu Kaisen.', 49.99, 4, 'Figure', '/img/products/n6.jpg'),
('Luffy Gear 5', 'Monkey D. Luffy Gear 5 figure from One Piece.', 39.99, 6, 'Figure', '/img/products/f6.jpg'),
('Avatar Fire & Ash', 'Figure inspired by Avatar Fire and Ash.', 19.99, 7, 'Figure', '/img/products/n8.jpg');
