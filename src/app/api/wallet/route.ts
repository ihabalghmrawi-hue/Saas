import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const supabase  = createClient()
  const companyId = await getCompanyId()
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const body      = await req.json()
  const { action } = body

  // ── Create a new wallet ────────────────────────────────────────────────────
  if (!action || action === 'create') {
    const { name, name_ar, type = 'cash', initial_balance = 0, bank_name, account_number } = body
    if (!name && !name_ar) return NextResponse.json({ error: 'اسم الصندوق مطلوب' }, { status: 400 })

    const balance = parseFloat(initial_balance) || 0

    // If this is the first wallet, make it default
    const { count } = await admin.from('wallets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true)
    const is_default = (count ?? 0) === 0

    const { data: wallet, error: wErr } = await admin.from('wallets').insert({
      company_id:      companyId,
      name:            name    || name_ar,
      name_ar:         name_ar || name,
      type,
      current_balance: balance,
      initial_balance: balance,
      is_default,
      is_active:       true,
      bank_name:       bank_name       || null,
      account_number:  account_number  || null,
    }).select().single()

    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })

    // Record initial balance as opening transaction
    if (balance > 0) {
      await admin.from('transactions').insert({
        company_id:      companyId,
        wallet_id:       wallet.id,
        type:            'income',
        amount:          balance,
        description:     'رصيد افتتاحي',
        description_ar:  'رصيد افتتاحي',
        reference_type:  'opening',
        transaction_date: new Date().toISOString().slice(0, 10),
        status:          'completed',
      })
    }

    await logAudit({ action: 'wallet.created', entityType: 'wallet', entityId: wallet.id, newValue: { name: wallet.name_ar, balance } })
    return NextResponse.json(wallet, { status: 201 })
  }

  // ── Deposit / Withdrawal ───────────────────────────────────────────────────
  if (action === 'deposit' || action === 'withdrawal') {
    const { wallet_id, amount, description, payment_method = 'cash' } = body
    if (!wallet_id) return NextResponse.json({ error: 'wallet_id مطلوب' }, { status: 400 })
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 })

    const { data: wallet, error: wErr } = await admin.from('wallets')
      .select('id, current_balance, name_ar, name')
      .eq('id', wallet_id).eq('company_id', companyId)
      .single()
    if (wErr || !wallet) return NextResponse.json({ error: 'الصندوق غير موجود' }, { status: 404 })

    const delta       = action === 'deposit' ? amt : -amt
    const new_balance = Number(wallet.current_balance || 0) + delta

    if (action === 'withdrawal' && new_balance < 0) {
      return NextResponse.json({ error: 'الرصيد غير كافٍ للسحب' }, { status: 400 })
    }

    const { error: updateErr } = await admin.from('wallets')
      .update({ current_balance: new_balance, updated_at: new Date().toISOString() })
      .eq('id', wallet_id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const desc = description || (action === 'deposit' ? 'إيداع' : 'سحب')
    await admin.from('transactions').insert({
      company_id:      companyId,
      wallet_id,
      type:            action === 'deposit' ? 'income' : 'expense',
      amount:          amt,
      description:     desc,
      description_ar:  desc,
      reference_type:  action,
      payment_method,
      transaction_date: new Date().toISOString().slice(0, 10),
      status:          'completed',
    })

    const auditAction = action === 'deposit' ? 'wallet.deposit' : 'wallet.withdrawal'
    await logAudit({ action: auditAction, entityType: 'wallet', entityId: wallet_id, newValue: { amount: amt, new_balance, description: desc } })
    return NextResponse.json({ ok: true, new_balance })
  }

  // ── Set default wallet ─────────────────────────────────────────────────────
  if (action === 'set_default') {
    const { wallet_id } = body
    if (!wallet_id) return NextResponse.json({ error: 'wallet_id مطلوب' }, { status: 400 })
    await admin.from('wallets').update({ is_default: false }).eq('company_id', companyId)
    await admin.from('wallets').update({ is_default: true  }).eq('id', wallet_id).eq('company_id', companyId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const { id }    = await req.json()
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

  // Check it's not the last active wallet
  const { count } = await admin.from('wallets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true)
  if ((count ?? 0) <= 1) return NextResponse.json({ error: 'لا يمكن حذف الصندوق الوحيد' }, { status: 400 })

  const { error } = await admin.from('wallets').update({ is_active: false }).eq('id', id).eq('company_id', companyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
