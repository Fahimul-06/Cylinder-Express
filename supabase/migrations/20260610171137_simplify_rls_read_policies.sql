/*
# Fix RLS read policies

The combination of anon_read_* and admin_select_* policies may be causing
issues for the anon key client. Simplify by:
1. Keeping the generic read policies that allow all reads for anon+authenticated
2. Removing the separate admin_select_* policies (admin still has INSERT/UPDATE/DELETE)
*/

-- Drop the admin SELECT policies that may be conflicting
DROP POLICY IF EXISTS "admin_select_products" ON products;
DROP POLICY IF EXISTS "admin_select_offers" ON offers;
DROP POLICY IF EXISTS "admin_select_orders" ON orders;
DROP POLICY IF EXISTS "admin_select_order_items" ON order_items;
DROP POLICY IF EXISTS "admin_select_addresses" ON addresses;
DROP POLICY IF EXISTS "admin_select_service_bookings" ON service_bookings;

-- Ensure there's a clear authenticated read policy for products and offers
-- (anon_read_* already exists with qual: true for anon,authenticated)
-- Add explicit authenticated read policy that doesn't require admin

-- For products: just use the existing anon_read_products which includes authenticated
-- Verify it exists, if not recreate
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'anon_read_products') THEN
    CREATE POLICY "anon_read_products" ON products FOR SELECT
      TO anon, authenticated USING (true);
  END IF;
END $$;

-- For offers: same
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'anon_read_offers') THEN
    CREATE POLICY "anon_read_offers" ON offers FOR SELECT
      TO anon, authenticated USING (true);
  END IF;
END $$;

-- For categories: same
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'anon_read_categories') THEN
    CREATE POLICY "anon_read_categories" ON categories FOR SELECT
      TO anon, authenticated USING (true);
  END IF;
END $$;
