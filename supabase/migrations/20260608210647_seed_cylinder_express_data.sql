/*
# Seed Cylinder Express with Bangladesh LPG Data

1. Categories inserted:
- LPG Cylinders
- Installation Parts (pipes, risers, regulators)
- Stoves & Burners
- Accessories & Safety
- Services (installation, safety check, refill delivery)

2. Products inserted with realistic Bangladesh market prices in BDT:
- Various cylinder sizes (5kg, 12kg, 15kg, 20kg, 35kg, 45kg) - new and refill
- Installation parts (rubber pipe, riser, regulator, valve)
- Stoves (single burner, double burner, triple burner)
- Accessories (gas detector, lighter, teflon tape)
- Services (home installation, safety check, emergency service)

3. No security changes - just data seeding
*/

-- Categories
INSERT INTO categories (name, slug, icon, description, sort_order) VALUES
('LPG Cylinders', 'cylinders', 'flame', 'New and refill LPG gas cylinders in various sizes', 1),
('Installation Parts', 'installation', 'wrench', 'Pipes, risers, regulators and valves for cylinder installation', 2),
('Stoves & Burners', 'stoves', 'cooking-pot', 'Gas stoves and burners for your kitchen', 3),
('Accessories & Safety', 'accessories', 'shield-check', 'Safety equipment and cylinder accessories', 4),
('Services', 'services', 'truck', 'Installation, safety checks, and delivery services', 5)
ON CONFLICT (slug) DO NOTHING;

-- LPG Cylinders - New
INSERT INTO products (category_id, name, description, price, image_url, type, size, unit, is_bestseller, sort_order) VALUES
((SELECT id FROM categories WHERE slug = 'cylinders'), '5kg LPG Cylinder', 'Compact 5kg LPG cylinder, perfect for small households and single users. Lightweight and easy to handle.', 650.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '5kg', 'cylinder', false, 1),
((SELECT id FROM categories WHERE slug = 'cylinders'), '12kg LPG Cylinder', 'Standard 12kg LPG cylinder, ideal for medium families. Most popular size in Bangladesh.', 1450.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '12kg', 'cylinder', true, 2),
((SELECT id FROM categories WHERE slug = 'cylinders'), '15kg LPG Cylinder', 'Popular 15kg LPG cylinder for regular household cooking. Great value for medium to large families.', 1700.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '15kg', 'cylinder', true, 3),
((SELECT id FROM categories WHERE slug = 'cylinders'), '20kg LPG Cylinder', 'Large 20kg LPG cylinder for big families and commercial use. Long-lasting supply.', 2100.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '20kg', 'cylinder', false, 4),
((SELECT id FROM categories WHERE slug = 'cylinders'), '35kg LPG Cylinder', 'Extra large 35kg cylinder for restaurants, hotels, and commercial kitchens.', 3500.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '35kg', 'cylinder', false, 5),
((SELECT id FROM categories WHERE slug = 'cylinders'), '45kg LPG Cylinder', 'Industrial 45kg cylinder for large-scale commercial operations and industrial use.', 4200.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '45kg', 'cylinder', false, 6)
ON CONFLICT DO NOTHING;

-- LPG Cylinders - Refill
INSERT INTO products (category_id, name, description, price, image_url, type, size, unit, is_bestseller, sort_order) VALUES
((SELECT id FROM categories WHERE slug = 'cylinders'), '5kg Cylinder Refill', 'Quick refill for your 5kg LPG cylinder. Same-day delivery available.', 450.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'refill', '5kg', 'cylinder', false, 7),
((SELECT id FROM categories WHERE slug = 'cylinders'), '12kg Cylinder Refill', 'Refill your 12kg LPG cylinder. Fast doorstep delivery across Dhaka.', 950.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'refill', '12kg', 'cylinder', true, 8),
((SELECT id FROM categories WHERE slug = 'cylinders'), '15kg Cylinder Refill', 'Refill your 15kg LPG cylinder. Reliable and timely delivery.', 1100.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'refill', '15kg', 'cylinder', true, 9),
((SELECT id FROM categories WHERE slug = 'cylinders'), '20kg Cylinder Refill', 'Refill for 20kg cylinder. Best for large families.', 1400.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'refill', '20kg', 'cylinder', false, 10),
((SELECT id FROM categories WHERE slug = 'cylinders'), '35kg Cylinder Refill', 'Commercial refill for 35kg cylinder.', 2400.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'refill', '35kg', 'cylinder', false, 11),
((SELECT id FROM categories WHERE slug = 'cylinders'), '45kg Cylinder Refill', 'Industrial refill for 45kg cylinder.', 2900.00, 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400', 'refill', '45kg', 'cylinder', false, 12)
ON CONFLICT DO NOTHING;

-- Installation Parts
INSERT INTO products (category_id, name, description, price, image_url, type, size, unit, is_bestseller, sort_order) VALUES
((SELECT id FROM categories WHERE slug = 'installation'), 'Rubber Gas Pipe (1.5m)', 'High-quality rubber gas pipe, 1.5 meter length. ISI marked, heat resistant.', 180.00, 'https://images.pexels.com/photos/6963944/pexels-photo-6963944.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '1.5m', 'piece', true, 1),
((SELECT id FROM categories WHERE slug = 'installation'), 'Rubber Gas Pipe (2m)', 'Premium rubber gas pipe, 2 meter length. Extra durable for long-distance connections.', 220.00, 'https://images.pexels.com/photos/6963944/pexels-photo-6963944.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '2m', 'piece', false, 2),
((SELECT id FROM categories WHERE slug = 'installation'), 'Gas Riser Pipe', 'Stainless steel gas riser pipe for wall-mounted cylinder installations. Professional grade.', 350.00, 'https://images.pexels.com/photos/6963944/pexels-photo-6963944.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', 'Standard', 'piece', true, 3),
((SELECT id FROM categories WHERE slug = 'installation'), 'Pressure Regulator', 'Adjustable pressure regulator with gauge. Ensures safe and consistent gas flow.', 450.00, 'https://images.pexels.com/photos/6963944/pexels-photo-6963944.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', 'Standard', 'piece', true, 4),
((SELECT id FROM categories WHERE slug = 'installation'), 'Cylinder Valve', 'Heavy-duty cylinder valve with safety lock. Compatible with all standard cylinders.', 280.00, 'https://images.pexels.com/photos/6963944/pexels-photo-6963944.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', 'Standard', 'piece', false, 5),
((SELECT id FROM categories WHERE slug = 'installation'), 'Teflon Tape (Roll)', 'Professional grade teflon tape for leak-proof thread sealing. 12m roll.', 40.00, 'https://images.pexels.com/photos/6963944/pexels-photo-6963944.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '12m', 'piece', false, 6)
ON CONFLICT DO NOTHING;

-- Stoves & Burners
INSERT INTO products (category_id, name, description, price, image_url, type, size, unit, is_bestseller, sort_order) VALUES
((SELECT id FROM categories WHERE slug = 'stoves'), 'Single Burner Gas Stove', 'Efficient single burner gas stove with brass burner. Compact design for small kitchens.', 850.00, 'https://images.pexels.com/photos/6209341/pexels-photo-6209341.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '1 Burner', 'piece', false, 1),
((SELECT id FROM categories WHERE slug = 'stoves'), 'Double Burner Gas Stove', 'Popular double burner gas stove with auto-ignition. Stainless steel body, brass burners.', 1650.00, 'https://images.pexels.com/photos/6209341/pexels-photo-6209341.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '2 Burner', 'piece', true, 2),
((SELECT id FROM categories WHERE slug = 'stoves'), 'Premium Double Burner', 'Premium double burner with tempered glass top and auto-ignition. Elegant design.', 2400.00, 'https://images.pexels.com/photos/6209341/pexels-photo-6209341.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '2 Burner', 'piece', false, 3),
((SELECT id FROM categories WHERE slug = 'stoves'), 'Triple Burner Gas Stove', 'Heavy-duty triple burner for large families. Stainless steel with brass burners.', 2800.00, 'https://images.pexels.com/photos/6209341/pexels-photo-6209341.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '3 Burner', 'piece', false, 4),
((SELECT id FROM categories WHERE slug = 'stoves'), 'Four Burner Gas Stove', 'Professional four burner gas stove for commercial kitchens and large households.', 3800.00, 'https://images.pexels.com/photos/6209341/pexels-photo-6209341.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', '4 Burner', 'piece', false, 5)
ON CONFLICT DO NOTHING;

-- Accessories & Safety
INSERT INTO products (category_id, name, description, price, image_url, type, size, unit, is_bestseller, sort_order) VALUES
((SELECT id FROM categories WHERE slug = 'accessories'), 'Gas Leak Detector', 'Electronic gas leak detector with alarm. Essential safety device for every home.', 1200.00, 'https://images.pexels.com/photos/6054261/pexels-photo-6054261.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', 'Standard', 'piece', true, 1),
((SELECT id FROM categories WHERE slug = 'accessories'), 'Long Gas Lighter', 'Premium long-reach gas lighter with safety lock. Windproof flame.', 150.00, 'https://images.pexels.com/photos/6054261/pexels-photo-6054261.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', 'Standard', 'piece', true, 2),
((SELECT id FROM categories WHERE slug = 'accessories'), 'Cylinder Trolley', 'Sturdy cylinder trolley with wheels for easy movement. Supports up to 45kg.', 650.00, 'https://images.pexels.com/photos/6054261/pexels-photo-6054261.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', 'Standard', 'piece', false, 3),
((SELECT id FROM categories WHERE slug = 'accessories'), 'Safety Gloves Set', 'Heat-resistant safety gloves for cylinder handling. Professional grade.', 250.00, 'https://images.pexels.com/photos/6054261/pexels-photo-6054261.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', 'Standard', 'set', false, 4),
((SELECT id FROM categories WHERE slug = 'accessories'), 'Cylinder Stand', 'Stable metal stand for cylinder placement. Prevents tipping.', 350.00, 'https://images.pexels.com/photos/6054261/pexels-photo-6054261.jpeg?auto=compress&cs=tinysrgb&w=400', 'new', 'Standard', 'piece', false, 5)
ON CONFLICT DO NOTHING;

-- Services
INSERT INTO products (category_id, name, description, price, image_url, type, size, unit, is_bestseller, sort_order) VALUES
((SELECT id FROM categories WHERE slug = 'services'), 'Home Installation Service', 'Professional LPG cylinder installation at your home. Includes pipe fitting, regulator setup, and leak test.', 500.00, 'https://images.pexels.com/photos/5765305/pexels-photo-5765305.jpeg?auto=compress&cs=tinysrgb&w=400', 'service', 'Standard', 'service', true, 1),
((SELECT id FROM categories WHERE slug = 'services'), 'Safety Check Service', 'Comprehensive gas safety inspection. Checks for leaks, pipe condition, regulator, and ventilation.', 300.00, 'https://images.pexels.com/photos/5765305/pexels-photo-5765305.jpeg?auto=compress&cs=tinysrgb&w=400', 'service', 'Standard', 'service', true, 2),
((SELECT id FROM categories WHERE slug = 'services'), 'Emergency Repair Service', '24/7 emergency gas repair service. Quick response for gas leaks and cylinder issues.', 800.00, 'https://images.pexels.com/photos/5765305/pexels-photo-5765305.jpeg?auto=compress&cs=tinysrgb&w=400', 'service', 'Standard', 'service', false, 3),
((SELECT id FROM categories WHERE slug = 'services'), 'Cylinder Exchange Service', 'Exchange your empty cylinder for a full one. Same-day service available in Dhaka.', 200.00, 'https://images.pexels.com/photos/5765305/pexels-photo-5765305.jpeg?auto=compress&cs=tinysrgb&w=400', 'service', 'Standard', 'service', true, 4),
((SELECT id FROM categories WHERE slug = 'services'), 'Pipe Replacement Service', 'Professional pipe replacement with quality materials. Includes leak testing.', 400.00, 'https://images.pexels.com/photos/5765305/pexels-photo-5765305.jpeg?auto=compress&cs=tinysrgb&w=400', 'service', 'Standard', 'service', false, 5)
ON CONFLICT DO NOTHING;
