/*
# Add Promo Code and Discount to Orders

1. Changes to `orders` table
- `promo_code` (text, nullable) — the promo code applied
- `discount_amount` (numeric, default 0) — discount amount in BDT

2. Notes
- Idempotent via DO $$ blocks.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'promo_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN promo_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN discount_amount numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
