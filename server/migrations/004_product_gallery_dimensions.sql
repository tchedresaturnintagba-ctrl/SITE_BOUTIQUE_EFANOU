ALTER TABLE products
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC(6,1) CHECK (width_cm IS NULL OR width_cm > 0),
  ADD COLUMN IF NOT EXISTS length_cm NUMERIC(6,1) CHECK (length_cm IS NULL OR length_cm > 0);

CREATE TABLE IF NOT EXISTS product_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_gallery_product_id_idx ON product_gallery(product_id, display_order);
