/*
# Fix infinite recursion in admin RLS policies

The problem: admin policies check if user is_admin by querying the profiles table,
but profiles also has RLS with admin policies that query profiles again = infinite recursion.

Solution: Create a SECURITY DEFINER function that bypasses RLS to check is_admin.
This function runs with elevated privileges, avoiding the circular RLS check.
*/

-- Drop the circular admin_read_profiles policy
DROP POLICY IF EXISTS "admin_read_profiles" ON profiles;

-- Create a security definer function to check if current user is admin
-- SECURITY DEFINER means it runs as the function owner, bypassing RLS
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE user_id = auth.uid()),
    false
  );
$$;

-- Fix admin policies on all tables to use the new function instead of subquery
-- Addresses
DROP POLICY IF EXISTS "admin_select_addresses" ON addresses;
DROP POLICY IF EXISTS "admin_insert_addresses" ON addresses;
DROP POLICY IF EXISTS "admin_update_addresses" ON addresses;
DROP POLICY IF EXISTS "admin_delete_addresses" ON addresses;

CREATE POLICY "admin_select_addresses" ON addresses FOR SELECT
  TO authenticated USING (is_current_user_admin());

CREATE POLICY "admin_insert_addresses" ON addresses FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_update_addresses" ON addresses FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_delete_addresses" ON addresses FOR DELETE
  TO authenticated USING (is_current_user_admin());

-- Orders
DROP POLICY IF EXISTS "admin_select_orders" ON orders;
DROP POLICY IF EXISTS "admin_insert_orders" ON orders;
DROP POLICY IF EXISTS "admin_update_orders" ON orders;
DROP POLICY IF EXISTS "admin_delete_orders" ON orders;

CREATE POLICY "admin_select_orders" ON orders FOR SELECT
  TO authenticated USING (is_current_user_admin());

CREATE POLICY "admin_insert_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_update_orders" ON orders FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_delete_orders" ON orders FOR DELETE
  TO authenticated USING (is_current_user_admin());

-- Order Items
DROP POLICY IF EXISTS "admin_select_order_items" ON order_items;
DROP POLICY IF EXISTS "admin_insert_order_items" ON order_items;
DROP POLICY IF EXISTS "admin_update_order_items" ON order_items;
DROP POLICY IF EXISTS "admin_delete_order_items" ON order_items;

CREATE POLICY "admin_select_order_items" ON order_items FOR SELECT
  TO authenticated USING (is_current_user_admin());

CREATE POLICY "admin_insert_order_items" ON order_items FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_update_order_items" ON order_items FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_delete_order_items" ON order_items FOR DELETE
  TO authenticated USING (is_current_user_admin());

-- Products
DROP POLICY IF EXISTS "admin_insert_products" ON products;
DROP POLICY IF EXISTS "admin_update_products" ON products;
DROP POLICY IF EXISTS "admin_delete_products" ON products;

CREATE POLICY "admin_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_update_products" ON products FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_delete_products" ON products FOR DELETE
  TO authenticated USING (is_current_user_admin());

-- Offers
DROP POLICY IF EXISTS "admin_insert_offers" ON offers;
DROP POLICY IF EXISTS "admin_update_offers" ON offers;
DROP POLICY IF EXISTS "admin_delete_offers" ON offers;

CREATE POLICY "admin_insert_offers" ON offers FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_update_offers" ON offers FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_delete_offers" ON offers FOR DELETE
  TO authenticated USING (is_current_user_admin());

-- Categories
DROP POLICY IF EXISTS "admin_insert_categories" ON categories;
DROP POLICY IF EXISTS "admin_update_categories" ON categories;
DROP POLICY IF EXISTS "admin_delete_categories" ON categories;

CREATE POLICY "admin_insert_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_update_categories" ON categories FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_delete_categories" ON categories FOR DELETE
  TO authenticated USING (is_current_user_admin());

-- Service Bookings
DROP POLICY IF EXISTS "admin_select_service_bookings" ON service_bookings;
DROP POLICY IF EXISTS "admin_insert_service_bookings" ON service_bookings;
DROP POLICY IF EXISTS "admin_update_service_bookings" ON service_bookings;
DROP POLICY IF EXISTS "admin_delete_service_bookings" ON service_bookings;

CREATE POLICY "admin_select_service_bookings" ON service_bookings FOR SELECT
  TO authenticated USING (is_current_user_admin());

CREATE POLICY "admin_insert_service_bookings" ON service_bookings FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_update_service_bookings" ON service_bookings FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "admin_delete_service_bookings" ON service_bookings FOR DELETE
  TO authenticated USING (is_current_user_admin());

-- Profiles - add back admin policy using the function
CREATE POLICY "admin_read_profiles" ON profiles FOR SELECT
  TO authenticated USING (is_current_user_admin());
