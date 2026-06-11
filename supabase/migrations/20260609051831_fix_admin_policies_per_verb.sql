/*
# Fix admin policies - replace ALL with per-verb policies

The admin_all_* policies using FOR ALL may interfere with read access.
Replace with per-CRUD-verb admin policies + explicit authenticated read policies.
*/

-- PRODUCTS: Drop ALL, add per-verb
DROP POLICY IF EXISTS "admin_all_products" ON products;
CREATE POLICY "admin_select_products" ON products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_insert_products" ON products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_update_products" ON products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_delete_products" ON products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- OFFERS: Drop ALL, add per-verb
DROP POLICY IF EXISTS "admin_all_offers" ON offers;
CREATE POLICY "admin_select_offers" ON offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_insert_offers" ON offers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_update_offers" ON offers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_delete_offers" ON offers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- CATEGORIES: Drop ALL, add per-verb
DROP POLICY IF EXISTS "admin_all_categories" ON categories;
CREATE POLICY "admin_insert_categories" ON categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_update_categories" ON categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_delete_categories" ON categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- ORDERS: Drop ALL, add per-verb
DROP POLICY IF EXISTS "admin_all_orders" ON orders;
CREATE POLICY "admin_select_orders" ON orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_update_orders" ON orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- ORDER_ITEMS: Drop ALL, add per-verb
DROP POLICY IF EXISTS "admin_all_order_items" ON order_items;
CREATE POLICY "admin_select_order_items" ON order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_insert_order_items" ON order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- ADDRESSES: Drop ALL, add per-verb
DROP POLICY IF EXISTS "admin_all_addresses" ON addresses;
CREATE POLICY "admin_select_addresses" ON addresses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- SERVICE_BOOKINGS: Drop ALL, add per-verb
DROP POLICY IF EXISTS "admin_all_service_bookings" ON service_bookings;
CREATE POLICY "admin_select_service_bookings" ON service_bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_update_service_bookings" ON service_bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
