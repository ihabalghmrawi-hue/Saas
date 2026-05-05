import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'

// GET /api/admin/subscriptions
export async function GET() {
  try {
    const supabase = await requireSuperAdmin()
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        id, status, plan, start_date, end_date, notes,
        companies!tenant_id (id, name)
      `)
      .order('end_date', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (res: any) { return res }
}

// PATCH /api/admin/subscriptions — update subscription
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await requireSuperAdmin()
    const body = await req.json()
    const { id, status, end_date, plan, notes, days } = body

    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

    const updates: Record<string, any> = {}
    if (status)   updates.status   = status
    if (plan)     updates.plan     = plan
    if (notes)    updates.notes    = notes
    if (end_date) updates.end_date = end_date

    // Extend by N days from today
    if (days && !end_date) {
      const d = new Date()
      d.setDate(d.getDate() + Number(days))
      updates.end_date = d.toISOString().split('T')[0]
      updates.status   = 'active'
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (res: any) { return res }
}
