#!/usr/bin/env node

const checks = [];
let allPassed = true;

function check(name, fn) {
  try {
    const result = fn();
    if (result) {
      checks.push({ name, passed: true, message: result });
    } else {
      checks.push({ name, passed: false, message: 'FAILED' });
      allPassed = false;
    }
  } catch (e) {
    checks.push({ name, passed: false, message: e.message });
    allPassed = false;
  }
}

// Environment checks
check('NODE_ENV', () => process.env.NODE_ENV || 'development');
check('Required env vars', () => {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (process.env.NODE_ENV === 'production') {
    required.push('SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET');
  }
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
  return `All required vars present (${required.length} checked)`;
});

// Docker checks
check('Dockerfile exists', () => {
  const fs = require('fs');
  return fs.existsSync('Dockerfile') ? 'Found Dockerfile' : false;
});

check('docker-compose config', () => {
  const { execSync } = require('child_process');
  execSync('docker compose -f docker-compose.yml config --quiet', { stdio: 'pipe' });
  return 'docker-compose.yml valid';
});

// Build check
check('Next.js build', () => {
  const { execSync } = require('child_process');
  execSync('npx next build', { stdio: 'pipe', timeout: 120000 });
  return 'Build successful';
});

// TypeScript check
check('TypeScript', () => {
  const { execSync } = require('child_process');
  execSync('npx tsc --noEmit', { stdio: 'pipe', timeout: 60000 });
  return 'TypeScript compilation passed';
});

// Lint check
check('Lint', () => {
  const { execSync } = require('child_process');
  execSync('npx next lint', { stdio: 'pipe', timeout: 60000 });
  return 'Lint passed';
});

// Summary
console.log('\n=== Deployment Validation Report ===\n');
for (const c of checks) {
  console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}: ${c.message}`);
}
console.log(`\nResult: ${allPassed ? 'ALL CHECKS PASSED ✓' : 'SOME CHECKS FAILED ✗'}`);
process.exit(allPassed ? 0 : 1);
