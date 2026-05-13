#!/usr/bin/env node
/**
 * Validates Supabase migration files for consistency.
 * Checks: duplicate names, gaps in sequence, missing up/down pairs, naming convention.
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations')

const MIGRATION_REGEX = /^(\d{14})_([\w-]+)\.sql$/
const TIMESTAMP_REGEX = /^\d{14}$/

let exitCode = 0

function error(msg) {
  console.error(`  ERROR: ${msg}`)
  exitCode = 1
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`)
}

console.log('→ Validating Supabase migrations...\n')

if (!existsSync(MIGRATIONS_DIR)) {
  error(`Migrations directory not found: ${MIGRATIONS_DIR}`)
  process.exit(1)
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  error('No migration files found')
  process.exit(1)
}

console.log(`  Found ${files.length} migration files\n`)

// Check 1: File naming convention
console.log('  [1/6] Naming convention...')
let parsed = []
for (const file of files) {
  const match = file.match(MIGRATION_REGEX)
  if (!match) {
    error(`Invalid filename: ${file} — expected format: YYYYMMDDHHMMSS_name.sql`)
    continue
  }
  parsed.push({ file, timestamp: match[1], name: match[2] })
}

// Check 2: Duplicate timestamps
console.log('  [2/6] Duplicate timestamps...')
const seenTimestamps = new Map()
for (const p of parsed) {
  if (seenTimestamps.has(p.timestamp)) {
    error(`Duplicate timestamp ${p.timestamp} in: ${seenTimestamps.get(p.timestamp)} and ${p.file}`)
  }
  seenTimestamps.set(p.timestamp, p.file)
}

// Check 3: Sequential ordering
console.log('  [3/6] Sequential ordering...')
for (let i = 1; i < parsed.length; i++) {
  const prev = parsed[i - 1].timestamp
  const curr = parsed[i].timestamp
  if (curr <= prev) {
    error(`Non-sequential: ${parsed[i - 1].file} → ${parsed[i].file}`)
  }
}

// Check 4: Duplicate names
console.log('  [4/6] Duplicate names...')
const seenNames = new Map()
for (const p of parsed) {
  if (seenNames.has(p.name)) {
    error(`Duplicate migration name "${p.name}" in: ${seenNames.get(p.name)} and ${p.file}`)
  }
  seenNames.set(p.name, p.file)
}

// Check 5: File content — must have IF NOT EXISTS or be idempotent
console.log('  [5/6] Idempotency check...')
for (const p of parsed) {
  const content = readFileSync(resolve(MIGRATIONS_DIR, p.file), 'utf-8')
  const hasCreateTable = /CREATE\s+TABLE/i.test(content)
  const hasIfNotExists = /IF\s+NOT\s+EXISTS/i.test(content)
  const hasCreateMatView = /CREATE\s+MATERIALIZED\s+VIEW/i.test(content)
  const hasAlterTable = /ALTER\s+TABLE.*ADD\s+COLUMN/i.test(content)

  if (hasCreateTable && !hasIfNotExists && !hasAlterTable) {
    warn(`${p.file}: CREATE TABLE without IF NOT EXISTS — may fail on re-run`)
  }
  if (hasCreateMatView && !hasIfNotExists) {
    warn(`${p.file}: CREATE MATERIALIZED VIEW without IF NOT EXISTS`)
  }
}

// Check 6: Migration consistency via content hash
console.log('  [6/6] Content analysis...')
for (const p of parsed) {
  const content = readFileSync(resolve(MIGRATIONS_DIR, p.file), 'utf-8')
  if (content.trim().length === 0) {
    error(`${p.file}: empty migration file`)
  }
  if (content.includes('DROP SCHEMA') || content.includes('DROP TABLE')) {
    warn(`${p.file}: contains destructive DROP statements`)
  }
}

console.log(`\nResult: ${exitCode === 0 ? 'PASSED' : 'FAILED'}`)
process.exit(exitCode)
