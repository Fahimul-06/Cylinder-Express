/*
# Add Floor Number and Floor Charge to Orders

1. Changes to `orders` table
- `floor_number` (int, nullable) — floor the cylinder must be delivered to (null = ground floor)
- `floor_charge` (numeric, default 0) — extra charge for above-ground-floor delivery

2. Notes
- Ground floor (floor 1) has no extra charge.
- Each floor above the 1st adds ৳20 per cylinder quantity.
- This is idempotent via DO $$ blocks.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'floor_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN floor_number int;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'floor_charge'
  ) THEN
    ALTER TABLE orders ADD COLUMN floor_charge numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
