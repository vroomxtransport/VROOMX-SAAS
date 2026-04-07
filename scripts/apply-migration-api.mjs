#!/usr/bin/env node
/**
 * Apply a SQL migration via the Supabase Management API.
 *
 * Use this runner when the legacy direct-DB endpoint (db.<ref>.supabase.co)
 * is unavailable — for most modern Supabase projects it has been removed.
 * The Management API exposes a /database/query endpoint that runs raw SQL
 * as the database owner using a personal access token.
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-migration-api.mjs <file.sql>
 *
 * Required env vars:
 *   SUPABASE_ACCESS_TOKEN — personal access token (sbp_...)
 *   SUPABASE_PROJECT_REF  — optional, defaults to parsing NEXT_PUBLIC_SUPABASE_URL
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = process.argv[2]
if (!file) {
  console.error('usage: node --env-file=.env.local scripts/apply-migration-api.mjs <file.sql>')
  process.exit(1)
}

const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN not set in environment')
  process.exit(1)
}

const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('Cannot determine project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL.')
  process.exit(1)
}

const sql = readFileSync(resolve(file), 'utf8')

console.log(`[migration] project=${projectRef} file=${file}`)

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const text = await res.text()
if (!res.ok) {
  console.error(`[migration] failed: ${res.status} ${res.statusText}`)
  console.error(text)
  process.exit(1)
}

console.log('[migration] success')
if (text && text !== '[]') console.log(text)
