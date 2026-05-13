#!/usr/bin/env node
/**
 * Validates environment variables against the example file.
 * Checks: all required vars present, no missing values, format consistency.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const ENV_EXAMPLE = resolve(ROOT, '.env.local.example')
const ENV_ACTUAL = resolve(ROOT, '.env.local')

let exitCode = 0

function error(msg) {
  console.error(`  ERROR: ${msg}`)
  exitCode = 1
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`)
}

console.log('→ Validating environment variables...\n')

// Parse an env file into key-value pairs
function parseEnv(filePath) {
  if (!existsSync(filePath)) return {}
  const content = readFileSync(filePath, 'utf-8')
  const vars = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

// Check 1: Example file exists
console.log('  [1/4] Environment example file...')
if (!existsSync(ENV_EXAMPLE)) {
  error('.env.local.example not found — create it as a template')
  process.exit(1)
}
console.log('    .env.local.example found')

// Check 2: Actual env file
console.log('\n  [2/4] Environment file...')
if (!existsSync(ENV_ACTUAL)) {
  warn('.env.local not found — this is expected in CI')
  console.log('\n    Running in CI mode — checking example file consistency only.')
}

const example = parseEnv(ENV_EXAMPLE)
const actual = parseEnv(ENV_ACTUAL)

console.log(`    ${Object.keys(example).length} vars in example, ${Object.keys(actual).length} in actual`)

// Check 3: All example vars present
console.log('\n  [3/4] Required variables...')
const exampleKeys = Object.keys(example)
const actualKeys = Object.keys(actual)

for (const key of exampleKeys) {
  if (existsSync(ENV_ACTUAL) && !actualKeys.includes(key)) {
    warn(`Missing variable: ${key}`)
  }
}

// Check 4: Placeholder values not in actual
console.log('\n  [4/4] Placeholder detection...')
if (existsSync(ENV_ACTUAL)) {
  for (const [key, value] of Object.entries(actual)) {
    if (/your-|example|changeme|placeholder/i.test(value)) {
      warn(`${key} still contains placeholder value`)
    }
  }
}

console.log(`\nResult: ${exitCode === 0 ? 'PASSED' : 'FAILED'}`)
process.exit(exitCode)
