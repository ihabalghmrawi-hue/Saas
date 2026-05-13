import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId }      from '@/lib/tenant'
import { ensureCOA, buildAccountTree } from '@/lib/accounting/index'

// ── GET: full chart of accounts (as tree) ────────────────────
export async function GET(req: NextRequest) {
  const supabase   = createClient()
  const company_id = req.headers.get('x-tenant-id') || await getCompanyId()
  const flat       = req.nextUrl.searchParams.get('flat') === 'true'

  try {
    const { data: accounts } = await supabase
      .from('accounts')
      .select(`
        id, code, name, name_ar, type, subtype,
        parent_id, level, is_postable, is_header,
        normal_balance, current_balance, account_group,
        is_active, is_system, description
      `)
      .eq('company_id', company_id)
      .order('code', { ascending: true })

    if (!accounts || accounts.length === 0) {
      // Seed default COA
      const { accounts: seeded } = await ensureCOA(createAdminClient(), company_id)
      const { data: seededAccounts } = await supabase
        .from('accounts')
        .select(`
          id, code, name, name_ar, type, subtype,
          parent_id, level, is_postable, is_header,
          normal_balance, current_balance, account_group,
          is_active, is_system, description
        `)
        .eq('company_id', company_id)
        .order('code', { ascending: true })

      if (flat) return NextResponse.json(seededAccounts || [])
      return NextResponse.json(buildAccountTree((seededAccounts || []) as any))
    }

    if (flat) return NextResponse.json(accounts)
    return NextResponse.json(buildAccountTree(accounts as any))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST: create custom account ───────────────────────────────
export async function POST(req: NextRequest) {
  const supabase   = createAdminClient()
  const company_id = req.headers.get('x-tenant-id') || await getCompanyId()

  try {
    const body = await req.json()
    const {
      code, name, name_ar, type, subtype,
      parent_id, normal_balance, description,
      account_group, level,
    } = body

    if (!code || !name || !type) {
      return NextResponse.json(
        { error: 'رمز الحساب والاسم والنوع مطلوبة' },
        { status: 400 },
      )
    }

    // Check code uniqueness for this company
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('company_id', company_id)
      .eq('code', code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `رمز الحساب ${code} موجود بالفعل` },
        { status: 409 },
      )
    }

    // Determine level from parent
    let accountLevel = level || 3
    let is_header    = false
    let is_postable  = true

    if (parent_id) {
      const { data: parent } = await supabase
        .from('accounts')
        .select('level')
        .eq('id', parent_id)
        .maybeSingle()
      if (parent) {
        accountLevel = Math.min(3, (parent.level || 2) + 1) as 1 | 2 | 3
      }
    }

    if (accountLevel < 3) {
      is_header   = true
      is_postable = false
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert({
        company_id,
        code,
        name,
        name_ar:        name_ar || name,
        type,
        subtype:        subtype || null,
        parent_id:      parent_id || null,
        level:          accountLevel,
        is_header,
        is_postable,
        normal_balance: normal_balance || (
          ['asset', 'cogs', 'expense'].includes(type) ? 'debit' : 'credit'
        ),
        description:    description || null,
        account_group:  account_group || null,
        current_balance: 0,
        is_active:       true,
        is_system:       false,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── PATCH: update account ─────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase   = createAdminClient()
  const company_id = req.headers.get('x-tenant-id') || await getCompanyId()

  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'معرف الحساب مطلوب' }, { status: 400 })
    }

    // Prevent modifying system accounts' critical fields
    const { data: existing } = await supabase
      .from('accounts')
      .select('is_system')
      .eq('id', id)
      .eq('company_id', company_id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 })
    }

    // Strip protected fields for system accounts
    if (existing.is_system) {
      delete updates.code
      delete updates.type
      delete updates.normal_balance
      delete updates.level
      delete updates.is_postable
      delete updates.is_header
    }

    // Don't allow company_id override
    delete updates.company_id
    delete updates.is_system

    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .eq('company_id', company_id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
