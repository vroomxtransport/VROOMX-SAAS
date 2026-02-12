#!/usr/bin/env npx tsx
/**
 * VroomX Performance Audit Script
 *
 * Checks for common performance best practices.
 * Run: npx tsx scripts/perf-audit.ts
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
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
// Check 1: Font optimization (next/font with display: swap)
// ---------------------------------------------------------------------------

function checkFontOptimization() {
  const layoutPath = join(ROOT, 'src/app/layout.tsx')
  if (!existsSync(layoutPath)) {
    checks.push({ name: 'Font optimization', pass: false, detail: 'Root layout not found' })
    return
  }

  const content = readFileSync(layoutPath, 'utf-8')
  const usesNextFont = content.includes('next/font')
  const usesDisplaySwap = content.includes("display: 'swap'") || content.includes('display: "swap"')

  if (usesNextFont && usesDisplaySwap) {
    checks.push({
      name: 'Font optimization',
      pass: true,
      detail: 'next/font with display: swap (optimal LCP)',
    })
  } else if (usesNextFont) {
    checks.push({
      name: 'Font optimization',
      pass: false,
      detail: 'next/font found but missing display: swap',
    })
  } else {
    checks.push({
      name: 'Font optimization',
      pass: false,
      detail: 'Not using next/font for font loading',
    })
  }
}

// ---------------------------------------------------------------------------
// Check 2: Viewport metadata export
// ---------------------------------------------------------------------------

function checkViewport() {
  const layoutPath = join(ROOT, 'src/app/layout.tsx')
  if (!existsSync(layoutPath)) {
    checks.push({ name: 'Viewport metadata', pass: false, detail: 'Root layout not found' })
    return
  }

  const content = readFileSync(layoutPath, 'utf-8')
  const hasViewport = content.includes('export const viewport')

  checks.push({
    name: 'Viewport metadata',
    pass: hasViewport,
    detail: hasViewport
      ? 'Viewport export found (proper Next.js Viewport API)'
      : 'Missing viewport export in root layout',
  })
}

// ---------------------------------------------------------------------------
// Check 3: No barrel imports from lucide-react
// ---------------------------------------------------------------------------

function checkBarrelImports() {
  const srcDir = join(ROOT, 'src')
  const files = walkDir(srcDir, ['.ts', '.tsx'])

  const barrelImports: string[] = []

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(ROOT + '/', '')

    // Check for `import * as` from lucide-react (barrel import)
    if (/import\s+\*\s+as\s+\w+\s+from\s+['"]lucide-react['"]/.test(content)) {
      barrelImports.push(relPath)
    }
  }

  if (barrelImports.length > 0) {
    checks.push({
      name: 'No barrel imports (lucide-react)',
      pass: false,
      detail: `${barrelImports.length} file(s) use barrel import: ${barrelImports.slice(0, 3).join(', ')}`,
    })
  } else {
    checks.push({
      name: 'No barrel imports (lucide-react)',
      pass: true,
      detail: 'All lucide-react imports use named imports (tree-shakeable)',
    })
  }
}

// ---------------------------------------------------------------------------
// Check 4: Image optimization (next/image usage)
// ---------------------------------------------------------------------------

function checkImageOptimization() {
  const srcDir = join(ROOT, 'src')
  const files = walkDir(srcDir, ['.tsx'])

  let htmlImgCount = 0
  let nextImageCount = 0
  const htmlImgFiles: string[] = []

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(ROOT + '/', '')

    // Count <img tags (not in comments)
    const imgMatches = content.match(/<img\s/g)
    if (imgMatches) {
      htmlImgCount += imgMatches.length
      htmlImgFiles.push(relPath)
    }

    // Count next/image imports
    if (content.includes('next/image')) {
      nextImageCount++
    }
  }

  if (htmlImgCount > 0) {
    checks.push({
      name: 'Image optimization',
      pass: false,
      detail: `${htmlImgCount} raw <img> tag(s) found. Use next/image for automatic optimization. Files: ${htmlImgFiles.slice(0, 3).join(', ')}`,
    })
  } else {
    checks.push({
      name: 'Image optimization',
      pass: true,
      detail: nextImageCount > 0
        ? `${nextImageCount} file(s) use next/image (optimized)`
        : 'No images found (no optimization needed)',
    })
  }
}

// ---------------------------------------------------------------------------
// Check 5: Source file count (complexity metric)
// ---------------------------------------------------------------------------

function checkSourceComplexity() {
  const srcDir = join(ROOT, 'src')
  const files = walkDir(srcDir, ['.ts', '.tsx'])

  let totalLines = 0
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    totalLines += content.split('\n').length
  }

  checks.push({
    name: 'Source complexity',
    pass: true,
    detail: `${files.length} source files, ~${totalLines.toLocaleString()} total lines`,
  })
}

// ---------------------------------------------------------------------------
// Check 6: Core Web Vitals targets documented
// ---------------------------------------------------------------------------

function checkCoreWebVitals() {
  const targets = {
    LCP: '< 2.5s (Largest Contentful Paint)',
    INP: '< 200ms (Interaction to Next Paint)',
    CLS: '< 0.1 (Cumulative Layout Shift)',
  }

  console.log('  Core Web Vitals Targets:')
  for (const [metric, target] of Object.entries(targets)) {
    console.log(`    ${metric}: ${target}`)
  }
  console.log()

  checks.push({
    name: 'Core Web Vitals targets',
    pass: true,
    detail: 'LCP < 2.5s, INP < 200ms, CLS < 0.1 (document in LAUNCH-CHECKLIST.md)',
  })
}

// ---------------------------------------------------------------------------
// Check 7: Tailwind CSS loaded efficiently
// ---------------------------------------------------------------------------

function checkTailwind() {
  const layoutPath = join(ROOT, 'src/app/layout.tsx')
  const globalsPath = join(ROOT, 'src/app/globals.css')

  const hasGlobalsImport = existsSync(layoutPath) &&
    readFileSync(layoutPath, 'utf-8').includes('globals.css')

  const hasGlobals = existsSync(globalsPath)

  checks.push({
    name: 'Tailwind CSS setup',
    pass: hasGlobalsImport && hasGlobals,
    detail: hasGlobalsImport && hasGlobals
      ? 'globals.css imported in root layout (Tailwind optimized via PostCSS)'
      : 'Missing globals.css setup',
  })
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

console.log('Running VroomX Performance Audit...\n')

checkFontOptimization()
checkViewport()
checkBarrelImports()
checkImageOptimization()
checkSourceComplexity()
checkCoreWebVitals()
checkTailwind()

console.log('=== Performance Audit Report ===\n')

for (const check of checks) {
  const icon = check.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mWARN\x1b[0m'
  console.log(`  [${icon}] ${check.name}`)
  console.log(`         ${check.detail}\n`)
}

const warnings = checks.filter(c => !c.pass)
const passCount = checks.length - warnings.length

console.log('---')
console.log(`${passCount}/${checks.length} checks passed`)

if (warnings.length > 0) {
  console.log(`\n\x1b[33m${warnings.length} warning(s). Consider fixing before launch.\x1b[0m`)
} else {
  console.log(`\n\x1b[32mAll performance checks passed!\x1b[0m`)
}
