import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'

export type ProductRow = {
  id: string
  categoryId: string
  category: string
  name: string
  slug: string
  sku: string
  description: string
  price: number
  oldPrice: number | null
  stock: number
  color: string
  colorHex: string
  imageKey: string | null
  imageUrl: string | null
  badge: string | null
  status: 'draft' | 'active' | 'archived'
  isFeatured: boolean
  createdAt: string
  updatedAt: string
}

export const productSelect = `
  SELECT
    p.id,
    p.category_id AS "categoryId",
    c.name AS category,
    p.name,
    p.slug,
    p.sku,
    p.description,
    p.price,
    p.old_price AS "oldPrice",
    p.stock,
    p.color,
    p.color_hex AS "colorHex",
    p.image_key AS "imageKey",
    p.image_url AS "imageUrl",
    p.badge,
    p.status,
    p.is_featured AS "isFeatured",
    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt"
  FROM products p
  JOIN categories c ON c.id = p.category_id`

const catalogueQuerySchema = z.object({
  category: z.string().trim().max(80).optional(),
  search: z.string().trim().max(100).optional(),
})

export const productsRouter = Router()

productsRouter.get('/product-images/:id', async (request, response) => {
  const imageId = z.string().uuid().safeParse(request.params.id)
  if (!imageId.success) {
    response.status(404).end()
    return
  }

  const result = await query<{ mimeType: string; imageData: Buffer }>(
    `SELECT mime_type AS "mimeType", image_data AS "imageData"
     FROM product_images
     WHERE id = $1`,
    [imageId.data],
  )
  const image = result.rows[0]

  if (!image) {
    response.status(404).end()
    return
  }

  response.set({
    'Content-Type': image.mimeType,
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
  response.send(image.imageData)
})

productsRouter.get('/categories', async (_request, response) => {
  const result = await query<{ id: string; name: string; slug: string }>(
    `SELECT id, name, slug FROM categories ORDER BY display_order, name`,
  )
  response.json({ categories: result.rows })
})

productsRouter.get('/products', async (request, response) => {
  const parsed = catalogueQuerySchema.safeParse(request.query)

  if (!parsed.success) {
    response.status(400).json({ message: 'Filtres de catalogue invalides.' })
    return
  }

  const category = parsed.data.category || null
  const search = parsed.data.search || null
  const result = await query<ProductRow>(
    `${productSelect}
     WHERE p.status = 'active'
       AND ($1::text IS NULL OR c.slug = $1)
       AND ($2::text IS NULL OR p.name ILIKE '%' || $2 || '%' OR p.description ILIKE '%' || $2 || '%')
     ORDER BY p.is_featured DESC, p.created_at DESC`,
    [category, search],
  )

  response.json({ products: result.rows })
})

productsRouter.get('/products/:slug', async (request, response) => {
  const result = await query<ProductRow>(
    `${productSelect} WHERE p.slug = $1 AND p.status = 'active'`,
    [request.params.slug],
  )

  if (!result.rows[0]) {
    response.status(404).json({ message: 'Produit introuvable.' })
    return
  }

  response.json({ product: result.rows[0] })
})