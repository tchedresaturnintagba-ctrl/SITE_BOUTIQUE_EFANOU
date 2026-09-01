import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool } from '../db.js'

const adminSchema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12),
  ADMIN_NAME: z.string().min(2).default('Administrateur Horizon Efanou'),
})

async function createAdmin() {
  const input = adminSchema.parse(process.env)
  const passwordHash = await bcrypt.hash(input.ADMIN_PASSWORD, 12)

  const result = await pool.query<{ id: string; email: string }>(
    `INSERT INTO admin_users (email, name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           is_active = TRUE
     RETURNING id, email`,
    [input.ADMIN_EMAIL.toLowerCase(), input.ADMIN_NAME, passwordHash],
  )

  console.log(`Administrateur prêt : ${result.rows[0]?.email}`)
  await pool.end()
}

createAdmin().catch((error) => {
  console.error('Impossible de créer l’administrateur :', error)
  process.exit(1)
})