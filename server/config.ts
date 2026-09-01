import 'dotenv/config'
import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('8h'),
})

const parsedEnvironment = environmentSchema.safeParse(process.env)

if (!parsedEnvironment.success) {
  console.error('Configuration serveur invalide :', parsedEnvironment.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsedEnvironment.data