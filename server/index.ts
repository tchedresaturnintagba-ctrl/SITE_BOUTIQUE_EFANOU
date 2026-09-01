import { app } from './app.js'
import { config } from './config.js'
import { pool } from './db.js'

const server = app.listen(config.PORT, () => {
  console.log(`API Horizon Efanou : http://localhost:${config.PORT}/api`)
})

const shutdown = () => {
  server.close(() => {
    void pool.end().finally(() => process.exit(0))
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)