import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const body = await req.json()

    const COMPANY_ID = await getCompanyId()
    const supabase = createClient()

    const allowed: Record<string, unknown> = {}

    if ('name' in body) {
      allowed.name = String(body.name || '')
    }

    if ('phone' in body) {
      allowed.phone = body.phone || null
    }

    if ('email' in body) {
      allowed.email = body.email || null
    }

    if ('address' in body) {
      allowed.address = body.address || null
    }

    if ('credit_limit' in body) {
      allowed.credit_limit = Number(body.credit_limit) || 0
    }

    if ('is_active' in body) {
      allowed.is_active = Boolean(body.is_active)
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .update({
        ...allowed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', COMPANY_ID)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ customer })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const COMPANY_ID = await getCompanyId()
    const supabase = createClient()

    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id)
      .eq('company_id', COMPANY_ID)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}