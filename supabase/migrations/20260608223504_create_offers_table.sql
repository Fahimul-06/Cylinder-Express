/*
# Create Offers Table

1. New Tables
- `offers`
  - `id` (uuid, primary key)
  - `title` (text) — headline e.g. "10% off 12kg Cylinder"
  - `description` (text) — short promo copy
  - `badge_text` (text) — pill label e.g. "LIMITED TIME"
  - `discount_type` (text) — 'percentage' | 'flat'
  - `discount_value` (numeric) — amount or percent off
  - `code` (text, nullable) — promo code if any
  - `product_id` (uuid, nullable) — linked product (optional)
  - `category_slug` (text, nullable) — target category filter link
  - `bg_from` (text) — Tailwind gradient from color class
  - `bg_to` (text) — Tailwind gradient to color class
  - `image_url` (text, nullable) — optional banner image
  - `valid_from` (timestamptz)
  - `valid_until` (timestamptz, nullable)
  - `is_active` (boolean, default true)
  - `sort_order` (int, default 0)
  - `created_at` (timestamptz)

2. Security
- RLS enabled; public read (anon + authenticated) so offers are visible to all signed-in users.
*/

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  badge_text text DEFAULT 'OFFER',
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage' | 'flat'
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  code text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  category_slug text,
  bg_from text NOT NULL DEFAULT 'from-orange-500',
  bg_to text NOT NULL DEFAULT 'to-red-600',
  image_url text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_offers" ON offers;
CREATE POLICY "anon_read_offers" ON offers FOR SELECT
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active, sort_order) WHERE is_active = true;
