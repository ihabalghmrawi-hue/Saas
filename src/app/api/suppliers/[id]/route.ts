import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }     = await params
    const body       = await req.json()
    const COMPANY_ID = await getCompanyId()
    const supabase   = createClient()

    const allowed: Record<string, unknown> = {}
    if ('name' in body)          allowed.name          = String(body.name || '')
    if ('phone' in body)         allowed.phone         = body.phone || null
    if ('email' in body)         allowed.email         = body.email || null
    if ('address' in body)       allowed.address       = body.address || null
    if ('payment_terms' in body) allowed.payment_terms = Number(body.payment_terms) || 30
    if ('is_active' in body)     allowed.is_active     = Boolean(body.is_active)

    const { data: supplier, error } = await supabase.from('suppliers')
      .update({ ...allowed, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', COMPANY_ID)
      .select().single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ supplier })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }     = await params
    const COMPANY_ID = await getCompanyId()
    const supabase   = createClient()
    await supabase.from('suppliers').update({ is_active: false })
      .eq('id', id)
      .eq('company_id', COMPANY_ID)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
