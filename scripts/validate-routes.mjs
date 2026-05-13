#!/usr/bin/env node
/**
 * Validates Next.js App Router API route handlers.
 * Checks: proper exports, error handling, response patterns.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const API_DIR = resolve(ROOT, 'src/app/api')

let exitCode = 0

function error(msg) {
  console.error(`  ERROR: ${msg}`)
  exitCode = 1
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`)
}

console.log('→ Validating API route handlers...\n')

if (!existsSync(API_DIR)) {
  console.log('  No API routes directory found — skipping')
  process.exit(0)
}

// Walk all route.ts files in api directory
const { execSync } = await import('child_process')
const files = execSync(`dir /s /b "${API_DIR}\\route.ts" 2>nul`, { encoding: 'utf-8' })
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)

if (files.length === 0) {
  console.log('  No route.ts files found — skipping')
  process.exit(0)
}

console.log(`  Found ${files.length} route handler files\n`)

// Checks
console.log('  [1/4] HTTP method exports...')
let checkedMethods = 0
for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  const relPath = file.replace(ROOT, '').replace(/\\/g, '/')

  for (const method of methods) {
    const regex = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`)
    if (regex.test(content)) {
      checkedMethods++
    }
  }
}
console.log(`    ${checkedMethods} exported handler functions found`)

// Check 2: Error handling patterns
console.log('\n  [2/4] Error handling...')
let routesWithTryCatch = 0
let routesWithRawNextResponse = 0
for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const relPath = file.replace(ROOT, '').replace(/\\/g, '/')

  if (!content.includes('try ') && !content.includes('try{') && !content.includes('try {')) {
    warn(`${relPath}: no try-catch found`)
  } else {
    routesWithTryCatch++
  }
}
console.log(`    ${routesWithTryCatch}/${files.length} routes have try-catch`)

// Check 3: Response consistency
console.log('\n  [3/4] Response patterns...')
let routesUsingApiResponse = 0
let routesWithDirectNextResponse = 0
for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const relPath = file.replace(ROOT, '').replace(/\\/g, '/')

  const usesApiResponse = content.includes('ok(') || content.includes('err(') || content.includes('Errors.')
  const usesDirectNextResponse = /NextResponse\.json\(/.test(content) || /new\s+Response\(/.test(content)

  if (usesApiResponse) routesUsingApiResponse++
  if (usesDirectNextResponse) routesWithDirectNextResponse++
}
console.log(`    ${routesUsingApiResponse} routes use ok()/err() helpers`)
console.log(`    ${routesWithDirectNextResponse} routes use raw NextResponse`)

// Check 4: Auth guard usage
console.log('\n  [4/4] Auth guard usage...')
let routesWithAuth = 0
for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  if (content.includes('requireAuth') || content.includes('requireRole') || content.includes('requireCompany')) {
    routesWithAuth++
  }
}
console.log(`    ${routesWithAuth}/${files.length} routes use auth guards`)

console.log(`\nResult: ${exitCode === 0 ? 'PASSED' : 'FAILED'}`)
process.exit(exitCode)
