-- Update cylinder products with Bangladesh LPG brand names
-- Major brands: Bashundhara LP Gas, Omera LPG, Totalgaz, BM LPG, Jamuna LPG

-- New cylinders - assign brands by size
UPDATE products SET
  name = 'Bashundhara LP Gas 5kg Cylinder',
  description = 'Bashundhara LP Gas 5kg cylinder. Compact and lightweight for small households. Certified safe, BDS standard compliant.'
WHERE type = 'new' AND size = '5kg' AND name ILIKE '%5kg%' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'Omera LPG 12kg Cylinder',
  description = 'Omera LPG 12kg cylinder — the most popular size in Bangladesh. Ideal for medium families. BDS standard, valve-sealed for safety.'
WHERE type = 'new' AND size = '12kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'Totalgaz 20kg Cylinder',
  description = 'Totalgaz 20kg cylinder for large families and small businesses. Long-lasting supply with TotalEnergies quality assurance.'
WHERE type = 'new' AND size = '20kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'BM LPG 25kg Cylinder',
  description = 'BM LPG 25kg heavy-duty cylinder. Perfect for restaurants, small hotels, and commercial kitchens. BDS certified.'
WHERE type = 'new' AND size = '25kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'Jamuna LPG 35kg Cylinder',
  description = 'Jamuna LPG 35kg cylinder for restaurants, hotels, and commercial kitchens. Extra-large capacity with industrial-grade valve.'
WHERE type = 'new' AND size = '35kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'Omera LPG 45kg Industrial Cylinder',
  description = 'Omera LPG 45kg industrial cylinder for large-scale commercial operations. Heavy-duty construction, pressure-tested and certified.'
WHERE type = 'new' AND size = '45kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

-- Refill cylinders - assign brands
UPDATE products SET
  name = 'Bashundhara LP Gas 5kg Refill',
  description = 'Refill for Bashundhara LP Gas 5kg cylinder. Same-day delivery available in Dhaka. Genuine certified refill.'
WHERE type = 'refill' AND size = '5kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'Omera LPG 12kg Refill',
  description = 'Refill for Omera LPG 12kg cylinder. Fast doorstep delivery across Dhaka. Factory-sealed, quality guaranteed.'
WHERE type = 'refill' AND size = '12kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'Totalgaz 20kg Refill',
  description = 'Refill for Totalgaz 20kg cylinder. Best for large families. Punctual delivery, TotalEnergies certified.'
WHERE type = 'refill' AND size = '20kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'BM LPG 25kg Refill',
  description = 'Commercial refill for BM LPG 25kg cylinder. Reliable supply for restaurants and small businesses.'
WHERE type = 'refill' AND size = '25kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'Jamuna LPG 35kg Refill',
  description = 'Commercial refill for Jamuna LPG 35kg cylinder. Scheduled delivery for businesses, verified weight guaranteed.'
WHERE type = 'refill' AND size = '35kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');

UPDATE products SET
  name = 'Omera LPG 45kg Industrial Refill',
  description = 'Industrial refill for Omera LPG 45kg cylinder. Priority delivery for commercial clients.'
WHERE type = 'refill' AND size = '45kg' AND category_id = (SELECT id FROM categories WHERE slug = 'cylinders');
