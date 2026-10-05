ALTER TABLE products
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS capacity TEXT;

UPDATE products SET dimensions = TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM width_cm::text)) || ' cm'
  WHERE dimensions IS NULL AND width_cm IS NOT NULL;
UPDATE products SET capacity = TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM length_cm::text)) || 'L'
  WHERE capacity IS NULL AND length_cm IS NOT NULL;
