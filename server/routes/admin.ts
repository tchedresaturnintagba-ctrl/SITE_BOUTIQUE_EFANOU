import { raw, Router } from 'express'
import { z } from 'zod'
import { pool, query } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { productSelect, type ProductRow } from './products.js'

type ApiOrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'

const productSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sku: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(2000),
  price: z.number().int().min(0),
  oldPrice: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0),
  color: z.string().trim().min(2).max(80),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  imageKey: z.string().trim().max(80).nullable().optional(),
  imageUrl: z.union([
    z.string().url().refine((url) => new URL(url).protocol === 'https:', 'L’image doit utiliser HTTPS.'),
    z.string().regex(/^\/api\/product-images\/[0-9a-f-]{36}$/),
  ]).nullable().optional(),
  badge: z.string().trim().max(50).nullable().optional(),
  status: z.enum(['draft', 'active', 'archived']),
  isFeatured: z.boolean(),
}).superRefine((product, context) => {
  if (!product.imageKey && !product.imageUrl) {
    context.addIssue({ code: 'custom', path: ['imageUrl'], message: 'Une image est obligatoire.' })
  }
  if (product.oldPrice !== null && product.oldPrice !== undefined && product.oldPrice < product.price) {
    context.addIssue({ code: 'custom', path: ['oldPrice'], message: 'L’ancien prix doit être supérieur au prix.' })
  }
})

const orderUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
}).refine((value) => value.status || value.paymentStatus, {
  message: 'Une modification est obligatoire.',
})

export const adminRouter = Router()
adminRouter.use(requireAdmin)

adminRouter.post(
  '/product-images',
  raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  async (request, response) => {
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      response.status(400).json({ message: 'Sélectionnez une image JPEG, PNG ou WebP.' })
      return
    }

    const mimeType = request.headers['content-type']
    if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      response.status(415).json({ message: 'Format d’image non pris en charge.' })
      return
    }

    const result = await query<{ id: string }>(
      `INSERT INTO product_images (mime_type, image_data)
       VALUES ($1, $2)
       RETURNING id`,
      [mimeType, request.body],
    )

    response.status(201).json({ imageUrl: `/api/product-images/${result.rows[0]?.id}` })
  },
)

adminRouter.get('/dashboard', async (_request, response) => {
  const [summary, recentOrders, lowStock] = await Promise.all([
    query<{ revenue: number; orders: number; products: number; pending: number }>(`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0)::int AS revenue,
        COUNT(*)::int AS orders,
        (SELECT COUNT(*)::int FROM products WHERE status != 'archived') AS products,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM orders
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
    `),
    query(`
      SELECT id, 'HE-' || LPAD(order_number::text, 6, '0') AS "orderNumber",
        customer_name AS "customerName", total, status,
        payment_status AS "paymentStatus", created_at AS "createdAt"
      FROM orders ORDER BY created_at DESC LIMIT 6
    `),
    query(`
      SELECT id, name, sku, stock FROM products
      WHERE status = 'active' AND stock <= 5 ORDER BY stock, name LIMIT 8
    `),
  ])

  response.json({
    summary: summary.rows[0],
    recentOrders: recentOrders.rows,
    lowStock: lowStock.rows,
  })
})

adminRouter.get('/products', async (_request, response) => {
  const result = await query<ProductRow>(`${productSelect} ORDER BY p.created_at DESC`)
  response.json({ products: result.rows })
})

adminRouter.post('/products', async (request, response) => {
  const parsed = productSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ message: 'Produit invalide.', errors: parsed.error.flatten().fieldErrors })
    return
  }

  const data = parsed.data
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const created = await client.query<{ id: string }>(
      `INSERT INTO products (
         category_id, name, slug, sku, description, price, old_price, stock,
         color, color_hex, image_key, image_url, badge, status, is_featured
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [data.categoryId, data.name, data.slug, data.sku, data.description, data.price, data.oldPrice ?? null, data.stock, data.color, data.colorHex, data.imageKey ?? null, data.imageUrl ?? null, data.badge ?? null, data.status, data.isFeatured],
    )
    const productId = created.rows[0]?.id
    await client.query(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create', 'product', $2, $3::jsonb)`,
      [request.admin?.id, productId, JSON.stringify({ name: data.name, sku: data.sku })],
    )
    await client.query('COMMIT')
    const product = await query<ProductRow>(`${productSelect} WHERE p.id = $1`, [productId])
    response.status(201).json({ product: product.rows[0] })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

adminRouter.put('/products/:id', async (request, response) => {
  const parsed = productSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ message: 'Produit invalide.', errors: parsed.error.flatten().fieldErrors })
    return
  }

  const data = parsed.data
  const result = await query<ProductRow>(
    `UPDATE products SET
       category_id = $1, name = $2, slug = $3, sku = $4, description = $5,
       price = $6, old_price = $7, stock = $8, color = $9, color_hex = $10,
       image_key = $11, image_url = $12, badge = $13, status = $14, is_featured = $15
     WHERE id = $16
     RETURNING id`,
    [data.categoryId, data.name, data.slug, data.sku, data.description, data.price, data.oldPrice ?? null, data.stock, data.color, data.colorHex, data.imageKey ?? null, data.imageUrl ?? null, data.badge ?? null, data.status, data.isFeatured, request.params.id],
  )

  if (!result.rows[0]) {
    response.status(404).json({ message: 'Produit introuvable.' })
    return
  }

  await query(
    `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
     VALUES ($1, 'update', 'product', $2, $3::jsonb)`,
    [request.admin?.id, request.params.id, JSON.stringify({ name: data.name, sku: data.sku })],
  )
  const product = await query<ProductRow>(`${productSelect} WHERE p.id = $1`, [request.params.id])
  response.json({ product: product.rows[0] })
})

adminRouter.delete('/products/:id', async (request, response) => {
  const result = await query<{ id: string }>(
    `UPDATE products SET status = 'archived' WHERE id = $1 RETURNING id`,
    [request.params.id],
  )
  if (!result.rows[0]) {
    response.status(404).json({ message: 'Produit introuvable.' })
    return
  }
  await query(
    `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id)
     VALUES ($1, 'archive', 'product', $2)`,
    [request.admin?.id, request.params.id],
  )
  response.status(204).end()
})

adminRouter.get('/orders', async (request, response) => {
  const status = typeof request.query.status === 'string' ? request.query.status : null
  const result = await query(`
    SELECT o.id,
      'HE-' || LPAD(o.order_number::text, 6, '0') AS "orderNumber",
      o.customer_name AS "customerName", o.customer_email AS "customerEmail",
      o.customer_phone AS "customerPhone", o.shipping_address AS "shippingAddress",
      o.notes, o.status, o.payment_method AS "paymentMethod",
      o.payment_status AS "paymentStatus", o.subtotal,
      o.shipping_fee AS "shippingFee", o.total, o.created_at AS "createdAt",
      COALESCE(json_agg(json_build_object(
        'id', oi.id, 'productId', oi.product_id, 'name', oi.product_name,
        'unitPrice', oi.unit_price, 'quantity', oi.quantity, 'lineTotal', oi.line_total
      )) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE ($1::text IS NULL OR o.status = $1)
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT 100
  `, [status])
  response.json({ orders: result.rows })
})

adminRouter.patch('/orders/:id', async (request, response) => {
  const parsed = orderUpdateSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ message: 'Modification de commande invalide.' })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const currentResult = await client.query<{ status: ApiOrderStatus }>(
      `SELECT status FROM orders WHERE id = $1 FOR UPDATE`,
      [request.params.id],
    )
    const currentOrder = currentResult.rows[0]

    if (!currentOrder) {
      await client.query('ROLLBACK')
      response.status(404).json({ message: 'Commande introuvable.' })
      return
    }

    if (currentOrder.status === 'cancelled' && parsed.data.status && parsed.data.status !== 'cancelled') {
      await client.query('ROLLBACK')
      response.status(409).json({ message: 'Une commande annulée ne peut pas être réouverte.' })
      return
    }

    if (parsed.data.status === 'cancelled' && currentOrder.status !== 'cancelled') {
      await client.query(
        `UPDATE products p
         SET stock = p.stock + oi.quantity
         FROM order_items oi
         WHERE oi.order_id = $1 AND oi.product_id = p.id`,
        [request.params.id],
      )
    }

    const result = await client.query(
      `UPDATE orders SET
         status = COALESCE($1, status),
         payment_status = COALESCE($2, payment_status)
       WHERE id = $3
       RETURNING id, 'HE-' || LPAD(order_number::text, 6, '0') AS "orderNumber",
         status, payment_status AS "paymentStatus", updated_at AS "updatedAt"`,
      [parsed.data.status ?? null, parsed.data.paymentStatus ?? null, request.params.id],
    )
    await client.query(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update_status', 'order', $2, $3::jsonb)`,
      [request.admin?.id, request.params.id, JSON.stringify(parsed.data)],
    )
    await client.query('COMMIT')
    response.json({ order: result.rows[0] })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})