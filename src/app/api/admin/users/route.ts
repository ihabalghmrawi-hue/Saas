import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'

// GET /api/admin/users?tenant_id=xxx
export async function GET(req: NextRequest) {
  try {
    const supabase   = await requireSuperAdmin()
    const tenantId   = req.nextUrl.searchParams.get('tenant_id')

    let query = supabase
      .from('memberships')
      .select(`
        id, role, is_active, created_at,
        role_id,
        companies!company_id (id, name),
        roles!role_id (id, name, label)
      `)
      .order('created_at', { ascending: false })

    if (tenantId) query = query.eq('company_id', tenantId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (res: any) { return res }
}

// PATCH /api/admin/users — activate/deactivate, change role
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await requireSuperAdmin()
    const { membership_id, is_active, role_id } = await req.json()

    if (!membership_id) return NextResponse.json({ error: 'membership_id مطلوب' }, { status: 400 })

    const updates: Record<string, any> = {}
    if (typeof is_active !== 'undefined') updates.is_active = is_active
    if (role_id)                          updates.role_id   = role_id

    const { data, error } = await supabase
      .from('memberships')
      .update(updates)
      .eq('id', membership_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (res: any) { return res }
}
