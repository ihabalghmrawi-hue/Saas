import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'

// GET /api/admin/roles — get all roles with permissions
export async function GET() {
  try {
    const supabase = await requireSuperAdmin()

    const [rolesRes, permsRes] = await Promise.all([
      supabase.from('roles').select('*').order('name'),
      supabase.from('permissions').select('*').order('group_name, key'),
    ])

    const rpRes = await supabase
      .from('role_permissions')
      .select('role_id, permission_id')

    return NextResponse.json({
      roles:       rolesRes.data  ?? [],
      permissions: permsRes.data  ?? [],
      rolePerms:   rpRes.data     ?? [],
    })
  } catch (res: any) { return res }
}

// POST /api/admin/roles — create custom role
export async function POST(req: NextRequest) {
  try {
    const supabase = await requireSuperAdmin()
    const { tenant_id, name, label, permission_ids = [] } = await req.json()

    if (!name?.trim()) return NextResponse.json({ error: 'اسم الدور مطلوب' }, { status: 400 })

    const { data: role, error: roleErr } = await supabase
      .from('roles')
      .insert({ tenant_id: tenant_id || null, name: name.trim(), label })
      .select()
      .single()

    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 })

    if (permission_ids.length > 0) {
      await supabase.from('role_permissions').insert(
        permission_ids.map((pid: string) => ({ role_id: role.id, permission_id: pid }))
      )
    }

    return NextResponse.json(role, { status: 201 })
  } catch (res: any) { return res }
}

// PATCH /api/admin/roles — update role permissions
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await requireSuperAdmin()
    const { role_id, permission_ids } = await req.json()

    if (!role_id) return NextResponse.json({ error: 'role_id مطلوب' }, { status: 400 })

    // Replace all permissions for this role
    await supabase.from('role_permissions').delete().eq('role_id', role_id)

    if (permission_ids?.length > 0) {
      await supabase.from('role_permissions').insert(
        permission_ids.map((pid: string) => ({ role_id, permission_id: pid }))
      )
    }

    return NextResponse.json({ ok: true })
  } catch (res: any) { return res }
}
