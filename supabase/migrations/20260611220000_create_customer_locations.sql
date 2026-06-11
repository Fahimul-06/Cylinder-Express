CREATE TABLE customer_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  is_sharing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE customer_locations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own location
CREATE POLICY "select_own_location" ON customer_locations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_location" ON customer_locations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_location" ON customer_locations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_location" ON customer_locations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Admin can read all locations
CREATE POLICY "admin_read_all_locations" ON customer_locations FOR SELECT
  TO authenticated USING (is_current_user_admin());
