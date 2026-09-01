CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  old_price INTEGER CHECK (old_price IS NULL OR old_price >= price),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  color TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#315f3c',
  image_key TEXT,
  image_url TEXT,
  badge TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (image_key IS NOT NULL OR image_url IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mobile_money', 'card', 'cash_on_delivery')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  shipping_fee INTEGER NOT NULL CHECK (shipping_fee >= 0),
  total INTEGER NOT NULL CHECK (total = subtotal + shipping_fee),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total INTEGER NOT NULL CHECK (line_total = unit_price * quantity)
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
CREATE INDEX IF NOT EXISTS products_name_search_idx ON products USING GIN (to_tsvector('simple', name || ' ' || description));
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON admin_users;
CREATE TRIGGER admin_users_set_updated_at BEFORE UPDATE ON admin_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS categories_set_updated_at ON categories;
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO categories (name, slug, display_order)
VALUES
  ('Repas', 'repas', 1),
  ('Livraison', 'livraison', 2),
  ('Pique-nique', 'pique-nique', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (
  category_id, name, slug, sku, description, price, old_price, stock,
  color, color_hex, image_key, badge, status, is_featured
)
VALUES
  ((SELECT id FROM categories WHERE slug = 'repas'), 'Le Classique', 'le-classique', 'HE-REP-001', 'Format quotidien, doublure isolante et poche frontale pratique.', 12500, 15000, 25, 'Vert forêt', '#315f3c', 'classic', 'Bestseller', 'active', TRUE),
  ((SELECT id FROM categories WHERE slug = 'pique-nique'), 'Le Familial', 'le-familial', 'HE-PIC-001', 'Un grand volume pour partager repas, boissons et goûters.', 19000, NULL, 18, 'Beige naturel', '#cfb998', 'family', 'Nouveau', 'active', TRUE),
  ((SELECT id FROM categories WHERE slug = 'repas'), 'L''Urbain', 'l-urbain', 'HE-REP-002', 'Une silhouette sobre pensée pour le bureau et les déplacements.', 14500, NULL, 20, 'Noir profond', '#292b2c', 'urban', NULL, 'active', FALSE),
  ((SELECT id FROM categories WHERE slug = 'repas'), 'Le Compact', 'le-compact', 'HE-REP-003', 'Léger et facile à porter, sans compromis sur la fraîcheur.', 9500, NULL, 30, 'Bleu lagon', '#58aab4', 'compact', 'Petit prix', 'active', FALSE),
  ((SELECT id FROM categories WHERE slug = 'livraison'), 'Le Coursier', 'le-coursier', 'HE-LIV-001', 'Maintien renforcé et grande capacité pour vos livraisons.', 28000, NULL, 12, 'Noir carbone', '#292b2c', 'delivery', NULL, 'active', TRUE),
  ((SELECT id FROM categories WHERE slug = 'pique-nique'), 'La Virée', 'la-viree', 'HE-PIC-002', 'Un sac généreux conçu pour les sorties et les longues journées.', 22000, NULL, 14, 'Orange solaire', '#d9772b', 'picnic', NULL, 'active', FALSE)
ON CONFLICT (slug) DO NOTHING;