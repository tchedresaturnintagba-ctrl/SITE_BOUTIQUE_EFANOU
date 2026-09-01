import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db.js'

const orderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().trim().min(8).max(30),
  shippingAddress: z.object({
    city: z.string().trim().min(2).max(100),
    commune: z.string().trim().min(2).max(100),
    address: z.string().trim().min(5).max(250),
    landmark: z.string().trim().max(250).optional(),
  }),
  paymentMethod: z.enum(['mobile_money', 'card', 'cash_on_delivery']),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
  })).min(1).max(20),
}).superRefine((order, context) => {
  const productIds = order.items.map((item) => item.productId)
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Chaque produit doit apparaître une seule fois.' })
  }
})

type LockedProduct = {
  id: string
  name: string
  price: number
  stock: number
  status: 'draft' | 'active' | 'archived'
}

type CreatedOrder = {
  id: string
  orderNumber: string
  total: number
  status: string
}

export const ordersRouter = Router()

ordersRouter.post('/orders', async (request, response) => {
  const parsed = orderSchema.safeParse(request.body)

  if (!parsed.success) {
    response.status(400).json({
      message: 'Les informations de commande sont invalides.',
      errors: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const productIds = parsed.data.items.map((item) => item.productId)
    const lockedProducts = await client.query<LockedProduct>(
      `SELECT id, name, price, stock, status
       FROM products
       WHERE id = ANY($1::uuid[])
       FOR UPDATE`,
      [productIds],
    )

    if (lockedProducts.rowCount !== productIds.length) {
      await client.query('ROLLBACK')
      response.status(400).json({ message: 'Un ou plusieurs produits sont introuvables.' })
      return
    }

    let subtotal = 0
    const lines = parsed.data.items.map((item) => {
      const product = lockedProducts.rows.find((row) => row.id === item.productId)

      if (!product || product.status !== 'active') {
        throw new Error('PRODUCT_UNAVAILABLE')
      }
      if (product.stock < item.quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${product.name}`)
      }

      const lineTotal = product.price * item.quantity
      subtotal += lineTotal
      return { product, quantity: item.quantity, lineTotal }
    })

    const shippingFee = subtotal >= 35000 ? 0 : 2500
    const total = subtotal + shippingFee
    const orderResult = await client.query<CreatedOrder>(
      `INSERT INTO orders (
         customer_name, customer_email, customer_phone, shipping_address,
         notes, payment_method, subtotal, shipping_fee, total
       )
       VALUES ($1, NULLIF($2, ''), $3, $4::jsonb, $5, $6, $7, $8, $9)
       RETURNING id,
         'HE-' || LPAD(order_number::text, 6, '0') AS "orderNumber",
         total,
         status`,
      [
        parsed.data.customerName,
        parsed.data.customerEmail || '',
        parsed.data.customerPhone,
        JSON.stringify(parsed.data.shippingAddress),
        parsed.data.notes || null,
        parsed.data.paymentMethod,
        subtotal,
        shippingFee,
        total,
      ],
    )
    const order = orderResult.rows[0]

    if (!order) throw new Error('ORDER_CREATION_FAILED')

    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, line.product.id, line.product.name, line.product.price, line.quantity, line.lineTotal],
      )
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [line.quantity, line.product.id],
      )
    }

    await client.query('COMMIT')
    response.status(201).json({ order })
  } catch (error) {
    await client.query('ROLLBACK')
    const message = error instanceof Error ? error.message : ''

    if (message === 'PRODUCT_UNAVAILABLE') {
      response.status(409).json({ message: 'Un produit n’est plus disponible.' })
      return
    }
    if (message.startsWith('INSUFFICIENT_STOCK:')) {
      response.status(409).json({ message: `Stock insuffisant pour ${message.split(':')[1]}.` })
      return
    }
    throw error
  } finally {
    client.release()
  }
})