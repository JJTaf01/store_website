-- Add missing columns to the users table (they exist in supabase-schema.sql
-- but were never applied to the actual database)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;

-- Refresh the schema cache so Supabase picks up the new columns
-- (run this in the Supabase SQL editor if the above doesn't resolve the issue)
SELECT pg_catalog.pg_reload_conf();
