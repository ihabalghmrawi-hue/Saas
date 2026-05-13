#!/usr/bin/env node
/**
 * Forbids console.log statements in production code.
 * Allows console.warn, console.error, and console.debug.
 * Skips test files, config files, and scripts.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

let exitCode = 0

function error(msg) {
  console.error(`  ERROR: ${msg}`)
  exitCode = 1
}

console.log('→ Checking for forbidden console.log in production code...\n')

const SKIP_DIRS = ['node_modules', '.next', '.git', '__tests__', 'scripts', 'coverage']
const SKIP_FILES = ['vitest.config.ts', 'next.config.js']

const CONSOLE_LOG_REGEX = /console\.\s*log\s*\(/

// Walk source files
const { execSync } = await import('child_process')
const result = execSync(
  `dir /s /b "${ROOT}\\src\\*.ts" "${ROOT}\\src\\*.tsx" 2>nul`,
  { encoding: 'utf-8' }
)

const files = result
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => !SKIP_DIRS.some((d) => f.includes(`\\${d}\\"`) || f.includes(`/${d}/`)))
  .filter((f) => !SKIP_FILES.some((sf) => f.endsWith(sf)))

let found = 0
for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    if (CONSOLE_LOG_REGEX.test(lines[i])) {
      const relPath = file.replace(ROOT, '').replace(/\\/g, '/')
      const line = lines[i].trim()
      error(`${relPath}:${i + 1} — ${line.substring(0, 100)}`)
      found++
    }
  }
}

if (found > 0) {
  console.log(`\n  Found ${found} console.log statement(s) — replace with console.error or a logger service.`)
} else {
  console.log('  No forbidden console.log found.')
}

console.log(`\nResult: ${exitCode === 0 ? 'PASSED' : 'FAILED'}`)
process.exit(exitCode)
