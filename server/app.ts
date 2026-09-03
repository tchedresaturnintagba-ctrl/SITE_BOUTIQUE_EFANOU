import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatabaseError } from 'pg'
import { config } from './config.js'
import { query } from './db.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { ordersRouter } from './routes/orders.js'
import { productsRouter } from './routes/products.js'

export const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: config.CLIENT_URL, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }))

app.get('/api/health', async (_request, response) => {
  try {
    await query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch {
    response.status(503).json({ status: 'error', database: 'unavailable' })
  }
})

app.use('/api/auth', authRouter)
app.use('/api', productsRouter)
app.use('/api', ordersRouter)
app.use('/api/admin', adminRouter)

if (config.NODE_ENV === 'production') {
  const staticDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
  app.use(express.static(staticDirectory))
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/')) {
      next()
      return
    }
    response.sendFile(path.join(staticDirectory, 'index.html'))
  })
}

app.use((_request, response) => {
  response.status(404).json({ message: 'Route introuvable.' })
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next
  const databaseError = error as Partial<DatabaseError>

  if (databaseError.code === '23505') {
    response.status(409).json({ message: 'Cette référence, ce slug ou cette adresse existe déjà.' })
    return
  }
  if (databaseError.code === '23503') {
    response.status(400).json({ message: 'La catégorie ou la ressource associée est invalide.' })
    return
  }
  if (databaseError.code === '22P02') {
    response.status(400).json({ message: 'L’identifiant fourni est invalide.' })
    return
  }

  console.error(error)
  response.status(500).json({ message: 'Une erreur interne est survenue.' })
})