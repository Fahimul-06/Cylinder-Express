/*
# Seed Offers Data

Inserts sample offers relevant to the Bangladesh LPG market.
Covers cylinders, refill discounts, installation bundles and seasonal promotions.
*/

INSERT INTO offers (title, description, badge_text, discount_type, discount_value, code, category_slug, bg_from, bg_to, valid_until, sort_order) VALUES
(
  '10% Off 12kg Refill',
  'Get 10% off on every 12kg cylinder refill this month. Fast same-day delivery in Dhaka.',
  'HOT DEAL',
  'percentage',
  10,
  'REFILL10',
  'cylinders',
  'from-orange-500',
  'to-red-500',
  now() + interval '30 days',
  1
),
(
  'Free Installation with New Cylinder',
  'Buy any new cylinder and get home installation service absolutely free. Limited slots available.',
  'FREE SERVICE',
  'flat',
  500,
  'INSTALL0',
  'services',
  'from-emerald-500',
  'to-teal-600',
  now() + interval '15 days',
  2
),
(
  '৳200 Off Safety Check',
  'Book a professional gas safety inspection and save ৳200. Keep your home safe this season.',
  'SAFETY FIRST',
  'flat',
  200,
  'SAFE200',
  'services',
  'from-blue-500',
  'to-cyan-600',
  now() + interval '20 days',
  3
),
(
  'Bundle: Stove + Pipe + Regulator',
  'Get a complete installation kit — double burner stove, 1.5m pipe, and pressure regulator at a special bundle price.',
  'BUNDLE SAVE',
  'percentage',
  15,
  'BUNDLE15',
  'installation',
  'from-violet-500',
  'to-purple-600',
  now() + interval '25 days',
  4
),
(
  'Eid Special: 5% Off All Products',
  'Celebrate with savings! Flat 5% off sitewide on all products and services during Eid.',
  'EID OFFER',
  'percentage',
  5,
  'EID5',
  NULL,
  'from-amber-500',
  'to-orange-600',
  now() + interval '10 days',
  5
),
(
  'Gas Leak Detector at ৳100 Off',
  'Protect your family. Get our top-rated gas leak detector for ৳100 less. While stocks last.',
  'LIMITED',
  'flat',
  100,
  'SAFE100',
  'accessories',
  'from-red-500',
  'to-rose-600',
  now() + interval '7 days',
  6
)
ON CONFLICT DO NOTHING;
