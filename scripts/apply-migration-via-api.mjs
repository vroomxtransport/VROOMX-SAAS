#!/usr/bin/env node
/**
 * Apply a migration via the Supabase Management API.
 *
 * Falls back path when the direct DB host is unreachable (e.g. IPv6-only
 * legacy host on an IPv4 network). Uses POST /v1/projects/{ref}/database/query
 * with SUPABASE_ACCESS_TOKEN for auth.
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-migration-via-api.mjs <file.sql>
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = process.argv[2]
if (!file) {
  console.error('usage: node --env-file=.env.local scripts/apply-migration-via-api.mjs <file.sql>')
  process.exit(1)
}

const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN not set in environment')
  process.exit(1)
}

// Derive project ref from the public Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL not set in environment')
  process.exit(1)
}
const refMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
if (!refMatch) {
  console.error(`Could not derive project ref from NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`)
  process.exit(1)
}
const projectRef = refMatch[1]

const sql = readFileSync(resolve(file), 'utf8')

console.log(`[migration] project: ${projectRef}`)
console.log(`[migration] applying ${file}`)

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const body = await res.text()

if (!res.ok) {
  console.error(`[migration] failed: ${res.status} ${res.statusText}`)
  console.error(body)
  process.exit(1)
}

console.log('[migration] success')
console.log(body)
