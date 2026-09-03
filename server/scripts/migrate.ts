import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pool } from '../db.js'

const migrationsDirectory = path.resolve(process.cwd(), 'server/migrations')

async function migrate() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const files = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort()

    for (const filename of files) {
      const existing = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename],
      )

      if (existing.rowCount) continue

      const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
      console.log(`Migration appliquée : ${filename}`)
    }

    await client.query('COMMIT')
    console.log('Base de données à jour.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error) => {
  console.error('Échec de la migration :', error)
  process.exit(1)
})