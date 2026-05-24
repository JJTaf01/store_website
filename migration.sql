-- Add missing columns to the users table (they exist in supabase-schema.sql
-- but were never applied to the actual database)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;

-- Add username to newsletters table
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS username TEXT DEFAULT '';

-- Add shipping fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_courier TEXT DEFAULT '';

-- Delete old users and their data (except the admin account)
DELETE FROM wishlist_items WHERE user_id IN (SELECT id FROM users WHERE email != 'jj3dprintshop@gmail.com');
DELETE FROM cart_items WHERE user_id IN (SELECT id FROM users WHERE email != 'jj3dprintshop@gmail.com');
DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email != 'jj3dprintshop@gmail.com');
DELETE FROM users WHERE email != 'jj3dprintshop@gmail.com';

-- Clear all newsletter subscribers (fresh start)
DELETE FROM newsletters;

-- Create contact_messages table for the chat/contact form
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh the schema cache so Supabase picks up the new columns
-- (run this in the Supabase SQL editor if the above doesn't resolve the issue)
SELECT pg_catalog.pg_reload_conf();
