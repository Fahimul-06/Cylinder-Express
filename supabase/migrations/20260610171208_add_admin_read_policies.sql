/*
# Add admin read policies for admin dashboard

Admin needs to read all records for:
- orders (to view and manage all customer orders)
- order_items (to see order details)
- addresses (to see delivery addresses on orders)
- service_bookings (to manage bookings)
- profiles (to see customer info) - already exists
*/

CREATE POLICY "admin_select_orders" ON orders FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

CREATE POLICY "admin_select_order_items" ON order_items FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

CREATE POLICY "admin_select_addresses" ON addresses FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

CREATE POLICY "admin_select_service_bookings" ON service_bookings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));
