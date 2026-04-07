#!/usr/bin/env node
/**
 * Apply a single SQL migration file directly via the postgres driver.
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-migration.mjs <migration-file.sql>
 *
 * Uses DATABASE_URL_DIRECT (port 5432) — NOT the pooled URL — because
 * migrations may use DDL statements that PgBouncer can't proxy through
 * its transaction mode.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const file = process.argv[2]
if (!file) {
  console.error('usage: node --env-file=.env.local scripts/apply-migration.mjs <migration-file.sql>')
  process.exit(1)
}

const url = process.env.DATABASE_URL_DIRECT
if (!url) {
  console.error('DATABASE_URL_DIRECT not set in environment')
  process.exit(1)
}

const sql = readFileSync(resolve(file), 'utf8')

const client = postgres(url, {
  prepare: false,
  max: 1,
  idle_timeout: 5,
  ssl: 'require',
})

try {
  console.log(`[migration] applying ${file}`)
  await client.unsafe(sql)
  console.log('[migration] success')
} catch (err) {
  console.error('[migration] failed:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
