#!/usr/bin/env npx tsx
/**
 * VroomX Security Audit Script
 *
 * Automated checks for common security issues before launch.
 * Run: npx tsx scripts/security-audit.ts
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'

interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

const checks: CheckResult[] = []
const ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkDir(dir: string, extensions: string[]): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
      results.push(...walkDir(fullPath, extensions))
    } else if (extensions.includes(extname(entry.name))) {
      results.push(fullPath)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Check 1: No secrets in NEXT_PUBLIC_ env vars
// ---------------------------------------------------------------------------

function checkEnvVars() {
  const envFiles = ['.env.local.example', '.env', '.env.local', '.env.production']
  const secretPatterns = ['secret', 'sk_live', 'sk_test', 'private_key', 'auth_token']
  let totalChecked = 0
  let issues: string[] = []

  for (const envFile of envFiles) {
    const filePath = join(ROOT, envFile)
    if (!existsSync(filePath)) continue

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    totalChecked++

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      if (!trimmed.startsWith('NEXT_PUBLIC_')) continue

      const lower = trimmed.toLowerCase()
      for (const pattern of secretPatterns) {
        if (lower.includes(pattern)) {
          issues.push(`${envFile}: ${trimmed.split('=')[0]} contains "${pattern}"`)
        }
      }
    }
  }

  if (totalChecked === 0) {
    checks.push({
      name: 'NEXT_PUBLIC_ env vars',
      pass: true,
      detail: 'No env files found (OK for CI)',
    })
  } else if (issues.length > 0) {
    checks.push({
      name: 'NEXT_PUBLIC_ env vars',
      pass: false,
      detail: `Found secrets exposed: ${issues.join('; ')}`,
    })
  } else {
    checks.push({
      name: 'NEXT_PUBLIC_ env vars',
      pass: true,
      detail: `Scanned ${totalChecked} env file(s), no secrets in NEXT_PUBLIC_ vars`,
    })
  }
}

// ---------------------------------------------------------------------------
// Check 2: All server actions verify getUser()
// ---------------------------------------------------------------------------

function checkAuthInActions() {
  const actionsDir = join(ROOT, 'src/app/actions')
  if (!existsSync(actionsDir)) {
    checks.push({ name: 'Auth in server actions', pass: false, detail: 'No actions directory found' })
    return
  }

  const files = readdirSync(actionsDir).filter(f => f.endsWith('.ts'))

  // Actions that legitimately skip auth (public endpoints)
  const authExemptFiles = ['auth.ts', 'logout.ts']

  for (const file of files) {
    const content = readFileSync(join(actionsDir, file), 'utf-8')
    const exportedFunctions = content.match(/export\s+async\s+function\s+\w+/g) || []

    if (exportedFunctions.length === 0) continue

    if (authExemptFiles.includes(file)) {
      checks.push({
        name: `Auth in ${file}`,
        pass: true,
        detail: `${exportedFunctions.length} action(s), auth-exempt (public endpoint)`,
      })
      continue
    }

    const hasGetUser = content.includes('getUser')
    if (!hasGetUser) {
      checks.push({
        name: `Auth in ${file}`,
        pass: false,
        detail: `${exportedFunctions.length} action(s) but NO getUser() call found`,
      })
    } else {
      checks.push({
        name: `Auth in ${file}`,
        pass: true,
        detail: `${exportedFunctions.length} action(s), auth verified`,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Check 3: Stripe webhook verifies signature
// ---------------------------------------------------------------------------

function checkWebhookSignature() {
  const webhookPath = join(ROOT, 'src/app/api/webhooks/stripe/route.ts')
  if (!existsSync(webhookPath)) {
    checks.push({ name: 'Webhook signature', pass: false, detail: 'Stripe webhook route not found' })
    return
  }

  const content = readFileSync(webhookPath, 'utf-8')
  const hasSignatureHeader = content.includes('stripe-signature')
  const hasConstructEvent = content.includes('constructEvent')
  const hasIdempotency = content.includes('stripe_events')

  const pass = hasSignatureHeader && hasConstructEvent
  let detail = ''
  if (pass) {
    detail = 'Signature verification + constructEvent found'
    if (hasIdempotency) detail += ' + idempotency check'
  } else {
    detail = 'MISSING: '
    if (!hasSignatureHeader) detail += 'stripe-signature header check; '
    if (!hasConstructEvent) detail += 'constructEvent call; '
  }

  checks.push({ name: 'Webhook signature', pass, detail })
}

// ---------------------------------------------------------------------------
// Check 4: No sk_ or secret keys exposed in src/
// ---------------------------------------------------------------------------

function checkExposedKeys() {
  const srcDir = join(ROOT, 'src')
  const files = walkDir(srcDir, ['.ts', '.tsx', '.js', '.jsx'])

  const dangerousPatterns = [
    { pattern: /sk_live_[a-zA-Z0-9]{20,}/, label: 'Stripe live secret key' },
    { pattern: /sk_test_[a-zA-Z0-9]{20,}/, label: 'Stripe test secret key' },
    { pattern: /sb_secret_[a-zA-Z0-9]{20,}/, label: 'Supabase secret key' },
    { pattern: /whsec_[a-zA-Z0-9]{20,}/, label: 'Webhook secret' },
    { pattern: /sntrys_[a-zA-Z0-9]{20,}/, label: 'Sentry auth token' },
  ]

  const found: string[] = []

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(ROOT + '/', '')

    for (const { pattern, label } of dangerousPatterns) {
      if (pattern.test(content)) {
        found.push(`${relPath}: ${label}`)
      }
    }
  }

  if (found.length > 0) {
    checks.push({
      name: 'No exposed keys in src/',
      pass: false,
      detail: `Found hardcoded secrets: ${found.join('; ')}`,
    })
  } else {
    checks.push({
      name: 'No exposed keys in src/',
      pass: true,
      detail: `Scanned ${files.length} source files, no hardcoded secrets`,
    })
  }
}

// ---------------------------------------------------------------------------
// Check 5: RLS coverage on all tables
// ---------------------------------------------------------------------------

function checkRLS() {
  const migrationsDir = join(ROOT, 'supabase/migrations')
  if (!existsSync(migrationsDir)) {
    checks.push({ name: 'RLS coverage', pass: false, detail: 'No migrations directory found' })
    return
  }

  const migrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
  const allTables: string[] = []
  const rlsTables: string[] = []

  for (const file of migrations) {
    const content = readFileSync(join(migrationsDir, file), 'utf-8')

    // Find CREATE TABLE statements
    const tableMatches = content.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)/gi)
    for (const match of tableMatches) {
      allTables.push(match[1])
    }

    // Find ALTER TABLE ... ENABLE ROW LEVEL SECURITY
    const rlsMatches = content.matchAll(/ALTER TABLE\s+(?:public\.)?(\w+)\s+ENABLE ROW LEVEL SECURITY/gi)
    for (const match of rlsMatches) {
      rlsTables.push(match[1])
    }
  }

  const missingRLS = allTables.filter(t => !rlsTables.includes(t))

  if (missingRLS.length > 0) {
    checks.push({
      name: 'RLS coverage',
      pass: false,
      detail: `${missingRLS.length} table(s) missing RLS: ${missingRLS.join(', ')}`,
    })
  } else {
    checks.push({
      name: 'RLS coverage',
      pass: true,
      detail: `All ${allTables.length} tables have RLS enabled`,
    })
  }
}

// ---------------------------------------------------------------------------
// Check 6: process.env secrets not used on client side
// ---------------------------------------------------------------------------

function checkClientSecretUsage() {
  const srcDir = join(ROOT, 'src')
  const clientFiles = walkDir(srcDir, ['.tsx', '.ts']).filter(f => {
    const content = readFileSync(f, 'utf-8')
    return content.includes("'use client'") || content.includes('"use client"')
  })

  const serverOnlyEnvs = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SECRET_KEY',
    'DATABASE_URL',
    'SENTRY_AUTH_TOKEN',
  ]

  const issues: string[] = []

  for (const file of clientFiles) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(ROOT + '/', '')
    for (const envVar of serverOnlyEnvs) {
      if (content.includes(envVar)) {
        issues.push(`${relPath} references ${envVar}`)
      }
    }
  }

  if (issues.length > 0) {
    checks.push({
      name: 'No server secrets in client files',
      pass: false,
      detail: `Found server-only env vars in client components: ${issues.join('; ')}`,
    })
  } else {
    checks.push({
      name: 'No server secrets in client files',
      pass: true,
      detail: `Scanned ${clientFiles.length} client component(s), no server-only env vars`,
    })
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

console.log('Running VroomX Security Audit...\n')

checkEnvVars()
checkAuthInActions()
checkWebhookSignature()
checkExposedKeys()
checkRLS()
checkClientSecretUsage()

console.log('=== Security Audit Report ===\n')

for (const check of checks) {
  const icon = check.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(`  [${icon}] ${check.name}`)
  console.log(`         ${check.detail}\n`)
}

const failures = checks.filter(c => !c.pass)
const passCount = checks.length - failures.length

console.log('---')
console.log(`${passCount}/${checks.length} checks passed`)

if (failures.length > 0) {
  console.log(`\n\x1b[31m${failures.length} check(s) FAILED. Review above for details.\x1b[0m`)
  process.exit(1)
} else {
  console.log(`\n\x1b[32mAll checks passed! Ready for launch.\x1b[0m`)
}
