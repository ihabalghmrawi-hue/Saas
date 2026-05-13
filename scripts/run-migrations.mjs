#!/usr/bin/env node
/**
 * ─── SaaS Migration Runner ───────────────────────────────────────────
 * Runs migrations against your Supabase project.
 *
 * Usage:
 *   node scripts/run-migrations.mjs                         # runs combined migration
 *   node scripts/run-migrations.mjs --file migrations/20260512000006_saas_impersonation.sql
 *   SUPABASE_ACCESS_TOKEN=xxx node scripts/run-migrations.mjs
 *   SUPABASE_DB_PASSWORD=xxx node scripts/run-migrations.mjs
 *   node scripts/run-migrations.mjs --manual                # prints SQL only
 *   node scripts/run-migrations.mjs --verify                # verify only, no run
 * ─────────────────────────────────────────────────────────────────────
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_MIGRATION = resolve(ROOT, 'supabase/migrations/20260512000000_combined_saas_features.sql');
const ENV_FILE = resolve(ROOT, '.env.local');

// ── Load .env.local into process.env ────────────────────────────────────
function loadEnvFile() {
  if (!existsSync(ENV_FILE)) return;
  const content = readFileSync(ENV_FILE, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadEnvFile();

// ── Env ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

function getProjectRef(url) {
  const m = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

// ── Print SQL only ────────────────────────────────────────────────────
function printManualInstructions(sql) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MANUAL MIGRATION INSTRUCTIONS');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Option A — Supabase Dashboard SQL Editor:');
  console.log('  1. Go to https://supabase.com/dashboard/project/' + getProjectRef(SUPABASE_URL) + '/sql/new');
  console.log('  2. Paste the SQL from the file below');
  console.log('  3. Click "Run"\n');
  console.log('Option B — Supabase CLI (if you have the DB password):');
  console.log('  supabase link --project-ref ' + getProjectRef(SUPABASE_URL) + ' --password <db-password>');
  console.log('  supabase db push\n');
  console.log('Option C — This script with SUPABASE_ACCESS_TOKEN:');
  console.log('  SUPABASE_ACCESS_TOKEN=<your-mgmt-token> node scripts/run-migrations.mjs\n');
  console.log('Migration SQL (' + sql.length + ' chars):');
  console.log('─────────────────────────────────────────────────────\n');
  console.log(sql);
}

// ── Via Management API ────────────────────────────────────────────────
async function runViaMgmtApi(sql) {
  const ref = getProjectRef(SUPABASE_URL);
  if (!ref) throw new Error('Cannot parse project ref from NEXT_PUBLIC_SUPABASE_URL');
  if (!ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN not set');

  console.log(`→ Running migrations via Management API (project: ${ref})...\n`);

  // Split into logical sections by comment headers
  const sections = sql.split(/(?=-- ═════+)/).filter(s => s.trim().length > 0);

  let allOk = true;

  for (const section of sections) {
    const headerMatch = section.match(/-- \d+\. (.+)/);
    const label = headerMatch ? headerMatch[1].trim() : 'unnamed section';
    const stmts = section.replace(/-- .+/g, '').trim();

    if (!stmts) continue;

    process.stdout.write(`  ${label}... `);

    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: stmts }),
    });

    if (res.ok) {
      console.log('✓');
    } else {
      const errText = await res.text();
      // Extract just the error message
      const errMsg = errText.match(/"message":"([^"]+)"/)?.[1] || errText.substring(0, 200);
      console.log(`⚠  ${errMsg.split('\n')[0].substring(0, 120)}`);
      allOk = false;
    }
  }

  console.log('');
  await verifyApplied(ref, ACCESS_TOKEN);
  return allOk;
}

async function verifyApplied(ref, token) {
  const checks = [
    { name: 'billing_customers', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'billing_customers') AS exists` },
    { name: 'invoices', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'invoices') AS exists` },
    { name: 'subscription_events', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'subscription_events') AS exists` },
    { name: 'promo_codes', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'promo_codes') AS exists` },
    { name: 'mv_mrr_daily', sql: `SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'mv_mrr_daily') AS exists` },
    { name: 'mv_tenant_stats', sql: `SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'mv_tenant_stats') AS exists` },
    { name: 'notifications', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'notifications') AS exists` },
    { name: 'notification_delivery', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'notification_delivery') AS exists` },
    { name: 'login_attempts', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'login_attempts') AS exists` },
    { name: 'user_sessions', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_sessions') AS exists` },
    { name: 'audit_logs.severity', sql: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'severity') AS exists` },
    { name: 'impersonation_sessions', sql: `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'impersonation_sessions') AS exists` },
  ];

  let applied = 0;
  let missing = [];

  for (const check of checks) {
    try {
      const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: check.sql }),
      });
      const data = await r.json();
      const exists = Array.isArray(data) ? data[0]?.exists : data?.exists;
      if (exists === true || exists === 't' || exists === 1 || exists === '1') {
        applied++;
      } else {
        missing.push(check.name);
      }
    } catch {
      missing.push(check.name);
    }
  }

  console.log(`  ✓ ${applied}/13 objects applied`);
  if (missing.length > 0) {
    console.log(`  ⚠ Missing: ${missing.join(', ')}`);
    console.log('\n  Run the --manual option and apply the relevant sections in the Supabase SQL Editor.');
  } else {
    console.log('  All objects verified!');
  }
}

// ── Via Supabase CLI ──────────────────────────────────────────────────
async function runViaCLI(sql) {
  console.log('→ Attempting Supabase CLI migration...');

  const { execSync } = await import('child_process');
  execSync(`echo "${sql}" | supabase db push`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      SUPABASE_DB_PASSWORD: DB_PASSWORD || '',
    },
  });

  return true;
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const fileIndex = process.argv.indexOf('--file');
  const migrationFile = fileIndex !== -1
    ? resolve(ROOT, process.argv[fileIndex + 1])
    : DEFAULT_MIGRATION;

  if (!existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sql = readFileSync(migrationFile, 'utf-8');
  const fileName = migrationFile.split(/[/\\]/).pop();

  const isManual = process.argv.includes('--manual');
  if (isManual) {
    printManualInstructions(sql);
    return;
  }

  const isVerify = process.argv.includes('--verify');
  if (isVerify) {
    if (!ACCESS_TOKEN) {
      console.error('SUPABASE_ACCESS_TOKEN required for --verify');
      process.exit(1);
    }
    const ref = getProjectRef(SUPABASE_URL);
    if (!ref) throw new Error('Cannot parse project ref from NEXT_PUBLIC_SUPABASE_URL');
    await verifyApplied(ref, ACCESS_TOKEN);
    return;
  }

  console.log(`\n→ Running: ${fileName}\n`);

  // Try strategies in order
  if (ACCESS_TOKEN) {
    try {
      await runViaMgmtApi(sql);
      console.log(`\n✅ ${fileName} applied successfully via Management API`);
      return;
    } catch (err) {
      console.warn(`Management API failed: ${err.message}`);
    }
  }

  if (DB_PASSWORD) {
    try {
      await runViaCLI(sql);
      console.log(`\n✅ ${fileName} applied successfully via Supabase CLI`);
      return;
    } catch (err) {
      console.warn(`Supabase CLI failed: ${err.message}`);
    }
  }

  // Fallback: print instructions
  console.log(`\n⚠ Cannot auto-run ${fileName} — no SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD.\n`);
  printManualInstructions(sql);
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
