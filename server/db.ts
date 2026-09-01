import pg from 'pg'
import { config } from './config.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (error) => {
  console.error('Erreur PostgreSQL inattendue :', error)
})

export const query = <Row extends pg.QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
) => pool.query<Row>(text, [...values])