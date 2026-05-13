// ============================================================
// Accounting Event Bus — Orchestration Layer
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { PostingRulesEngine, allocateToCostCenters, allocateToBranches } from './posting-rules'
import { RecurringJournalEngine } from './recurring'
import { AIAccountingEngine } from './ai-accounting'
import { logAudit } from '@/lib/audit'
import type { AccountingEvent } from './events'
import { postAccountingEvent } from './engine'

type EventHandler = (event: AccountingEvent, supabase: SupabaseClient, companyId: string) => Promise<void>

export class AccountingEventBus {
  private handlers: Map<string, EventHandler[]> = new Map()
  private supabase: SupabaseClient
  private companyId: string

  constructor(supabase: SupabaseClient, companyId: string) {
    this.supabase = supabase
    this.companyId = companyId
    this.registerDefaultHandlers()
  }

  on(eventType: string, handler: EventHandler) {
    const existing = this.handlers.get(eventType) || []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  async emit(event: AccountingEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || []
    const wildcard = this.handlers.get('*') || []

    for (const handler of [...handlers, ...wildcard]) {
      await handler(event, this.supabase, this.companyId)
    }
  }

  private registerDefaultHandlers() {
    // 1. Post to general ledger
    this.on('*', async (event) => {
      await postAccountingEvent(this.supabase, event)
    })

    // 2. Apply posting rules
    this.on('*', async (event) => {
      const engine = new PostingRulesEngine(this.supabase, this.companyId)
      await engine.resolveEvent(event)
    })

    // 3. Log to audit trail
    this.on('*', async (event) => {
      await logAudit({
        action: 'accounting.event.processed',
        entityType: 'accounting_event',
        entityId: event.reference,
        companyId: this.companyId,
        metadata: {
          type: event.type,
          amount: event.amount,
          description: event.description,
        },
      })
    })

    // 4. AI anomaly check for large transactions
    this.on('*', async (event) => {
      if (event.amount > 100000) {
        const ai = new AIAccountingEngine(this.supabase, this.companyId)
        const anomalies = await ai.detectAnomalies()
        if (anomalies.length > 0) {
          await this.supabase.from('ai_insights').insert(
            anomalies.map(a => ({
              company_id: this.companyId,
              category: 'anomaly',
              type: a.type,
              message: a.message,
              severity: a.severity,
              confidence: a.severity === 'high' ? 0.9 : 0.7,
              metadata: a.details,
            }))
          )
        }
      }
    })
  }
}

// ── Worker: Process Recurring Journals ──────────────────────────
export async function processRecurringJournals(supabase: SupabaseClient) {
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('is_active', true)

  if (!companies) return { processed: 0, results: [] }

  let totalProcessed = 0
  const allResults: Array<{ company_id: string; results: any[] }> = []

  for (const company of companies) {
    const engine = new RecurringJournalEngine(supabase, company.id)
    const results = await engine.processDueJournals()
    totalProcessed += results.filter(r => r.status === 'success').length
    allResults.push({ company_id: company.id, results })
  }

  return { processed: totalProcessed, results: allResults }
}

// ── Worker: Suggest Reconciliations ─────────────────────────────
export async function suggestReconciliations(supabase: SupabaseClient) {
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('is_active', true)

  if (!companies) return []

  const suggestions: Array<{ company_id: string; count: number }> = []

  for (const company of companies) {
    const ai = new AIAccountingEngine(supabase, company.id)
    const recs = await ai.suggestReconciliation()
    if (recs.length > 0) {
      suggestions.push({ company_id: company.id, count: recs.length })
      await supabase.from('ai_insights').insert({
        company_id: company.id,
        category: 'reconciliation_suggestion',
        type: 'reconciliation',
        message: `تم اقتراح ${recs.length} تسوية`,
        severity: 'info',
        confidence: 0.8,
        metadata: { suggestions: recs.slice(0, 10) },
      })
    }
  }

  return suggestions
}

// ── Worker: Integrity Check ─────────────────────────────────────
export async function runIntegrityChecks(supabase: SupabaseClient) {
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('is_active', true)

  if (!companies) return []

  const results: Array<{ company_id: string; passed: boolean; issues: number }> = []

  for (const company of companies) {
    const { data: unbalanced } = await supabase.rpc('check_unbalanced_entries', {
      p_company_id: company.id,
    })

    const issues = (unbalanced || []).length
    results.push({
      company_id: company.id,
      passed: issues === 0,
      issues,
    })

    await supabase.from('integrity_checks').insert({
      company_id: company.id,
      check_type: 'daily_integrity',
      status: issues === 0 ? 'passed' : 'failed',
      details: { unbalanced_count: issues, entries: unbalanced || [] },
    })
  }

  return results
}
