import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'

// GET /api/admin/tenants — list all companies with subscription status
export async function GET() {
  try {
    const supabase = await requireSuperAdmin()
    const { data, error } = await supabase
      .from('companies')
      .select(`
        id, name, created_at,
        subscriptions (status, plan, end_date, start_date)
      `)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (res: any) { return res }
}

// POST /api/admin/tenants — create new company
export async function POST(req: NextRequest) {
  try {
    const supabase = await requireSuperAdmin()
    const body = await req.json()
    const { name, plan = 'free', days = 30 } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الشركة مطلوب' }, { status: 400 })
    }

    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .insert({ name: name.trim(), slug: name.trim().toLowerCase().replace(/\s+/g, '-') })
      .select()
      .single()

    if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 500 })

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)

    await supabase.from('subscriptions').insert({
      tenant_id:  company.id,
      status:     'active',
      plan,
      start_date: new Date().toISOString().split('T')[0],
      end_date:   endDate.toISOString().split('T')[0],
    })

    return NextResponse.json(company, { status: 201 })
  } catch (res: any) { return res }
}
