import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { config } from '../config.js'
import { query } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'

type AdminRow = {
  id: string
  email: string
  name: string
  password_hash: string
  role: 'admin'
  is_active: boolean
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const authRouter = Router()

authRouter.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
  async (request, response) => {
    const parsed = loginSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({ message: 'Adresse e-mail ou mot de passe invalide.' })
      return
    }

    const result = await query<AdminRow>(
      `SELECT id, email, name, password_hash, role, is_active
       FROM admin_users
       WHERE email = $1`,
      [parsed.data.email.toLowerCase()],
    )
    const admin = result.rows[0]
    const passwordValid = admin
      ? await bcrypt.compare(parsed.data.password, admin.password_hash)
      : false

    if (!admin || !admin.is_active || !passwordValid) {
      response.status(401).json({ message: 'Adresse e-mail ou mot de passe incorrect.' })
      return
    }

    const token = jwt.sign(
      { email: admin.email, role: admin.role },
      config.JWT_SECRET,
      {
        subject: admin.id,
        expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'],
      },
    )

    await query(
      `UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`,
      [admin.id],
    )

    response.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    })
  },
)

authRouter.get('/me', requireAdmin, async (request, response) => {
  const result = await query<{ id: string; email: string; name: string; role: 'admin' }>(
    `SELECT id, email, name, role FROM admin_users WHERE id = $1 AND is_active = TRUE`,
    [request.admin?.id],
  )

  if (!result.rows[0]) {
    response.status(401).json({ message: 'Compte administrateur indisponible.' })
    return
  }

  response.json({ admin: result.rows[0] })
})