import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'
import { hashPin } from '@/lib/session'
import { logAudit } from '@/lib/audit'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch roles by IDs — tries with `permissions` column, falls back without it */
async function fetchRoles(admin: ReturnType<typeof createAdminClient>, roleIds: string[]) {
  if (!roleIds.length) return {}

  // Try with permissions column
  const { data, error } = await admin
    .from('staff_roles')
    .select('id, name, name_ar, permissions')
    .in('id', roleIds)

  if (!error) {
    return Object.fromEntries((data || []).map(r => [r.id, r]))
  }

  // Column missing — fetch without it and return empty permissions
  const { data: fallback } = await admin
    .from('staff_roles')
    .select('id, name, name_ar')
    .in('id', roleIds)

  return Object.fromEntries(
    (fallback || []).map(r => [r.id, { ...r, permissions: [] }])
  )
}

/** Create or update a role — stores permissions in JSONB if column exists */
async function upsertRolePermissions(
  admin:      ReturnType<typeof createAdminClient>,
  roleId:     string,
  updates:    Record<string, unknown>,
) {
  // Try with permissions; if column doesn't exist the error is swallowed
  const { error } = await admin.from('staff_roles').update(updates).eq('id', roleId)
  if (error && error.message.includes('permissions')) {
    // permissions column doesn't exist — update everything except permissions
    const { permissions: _p, ...rest } = updates
    if (Object.keys(rest).length > 0) {
      await admin.from('staff_roles').update(rest).eq('id', roleId)
    }
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()

  const { data: staffUsers, error } = await admin
    .from('staff_users')
    .select('id, name, is_active, role_id, created_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!staffUsers?.length) return NextResponse.json([])

  const roleIds = [...new Set(staffUsers.map(s => s.role_id).filter(Boolean))] as string[]
  const roleMap = await fetchRoles(admin, roleIds)

  const result = staffUsers.map(s => ({
    ...s,
    staff_roles: s.role_id ? (roleMap[s.role_id] ?? null) : null,
  }))

  return NextResponse.json(result)
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const body      = await req.json()
  const { name, pin, role_name = 'staff', role_name_ar = 'موظف', permissions = [] } = body

  if (!name?.trim())
    return NextResponse.json({ error: 'اسم الموظف مطلوب' }, { status: 400 })
  if (!pin || !/^\d{4,6}$/.test(pin))
    return NextResponse.json({ error: 'الرقم السري يجب أن يكون 4-6 أرقام' }, { status: 400 })

  const pinHash = await hashPin(pin)

  // Try inserting role WITH permissions; fall back without if column missing
  let role: any = null
  const roleBase = {
    company_id: companyId,
    name:       `${role_name}_${Date.now()}`,
    name_ar:    role_name_ar,
    permissions,
  }

  const { data: r1, error: e1 } = await admin
    .from('staff_roles').insert(roleBase).select().single()

  if (e1) {
    if (e1.message.includes('permissions')) {
      // Column doesn't exist yet — insert without it
      const { permissions: _p, ...roleWithout } = roleBase
      const { data: r2, error: e2 } = await admin
        .from('staff_roles').insert(roleWithout).select().single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      role = r2
    } else {
      return NextResponse.json({ error: e1.message }, { status: 500 })
    }
  } else {
    role = r1
  }

  // Create the staff user
  const { data: staff, error: staffErr } = await admin
    .from('staff_users')
    .insert({
      company_id: companyId,
      name:       name.trim(),
      pin_hash:   pinHash,
      role_id:    role.id,
      is_active:  true,
    })
    .select('id, name, is_active, role_id, created_at')
    .single()

  if (staffErr) {
    await admin.from('staff_roles').delete().eq('id', role.id)
    return NextResponse.json({ error: staffErr.message }, { status: 500 })
  }

  await logAudit({
    action:     'staff.created',
    entityType: 'staff_users',
    entityId:   staff.id,
    newValue:   { name: name.trim(), role: role_name_ar, permissions },
  })

  return NextResponse.json({
    ...staff,
    staff_roles: { ...role, permissions: role.permissions ?? permissions },
  }, { status: 201 })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const body      = await req.json()
  const { id, name, pin, permissions, role_name_ar } = body

  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

  const { data: current } = await admin
    .from('staff_users')
    .select('name, role_id')
    .eq('id', id).eq('company_id', companyId)
    .single()

  if (!current) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })

  // Update user fields
  const userUpdates: Record<string, unknown> = {}
  if (name?.trim())                 userUpdates.name     = name.trim()
  if (pin && /^\d{4,6}$/.test(pin)) userUpdates.pin_hash = await hashPin(pin)
  if (Object.keys(userUpdates).length > 0) {
    await admin.from('staff_users').update(userUpdates).eq('id', id).eq('company_id', companyId)
  }

  // Update role
  if (current.role_id) {
    const roleUpdates: Record<string, unknown> = {}
    if (Array.isArray(permissions)) roleUpdates.permissions = permissions
    if (role_name_ar)               roleUpdates.name_ar     = role_name_ar
    if (Object.keys(roleUpdates).length > 0) {
      await upsertRolePermissions(admin, current.role_id, roleUpdates)
    }
  }

  // Re-fetch
  const { data: updatedUser } = await admin
    .from('staff_users')
    .select('id, name, is_active, role_id, created_at')
    .eq('id', id).single()

  const roleMap = updatedUser?.role_id
    ? await fetchRoles(admin, [updatedUser.role_id])
    : {}

  await logAudit({
    action:     'staff.updated',
    entityType: 'staff_users',
    entityId:   id,
    newValue:   { name: userUpdates.name || current.name, permissions },
  })

  return NextResponse.json({
    ...updatedUser,
    staff_roles: updatedUser?.role_id ? (roleMap[updatedUser.role_id] ?? null) : null,
  })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const { id }    = await req.json()

  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

  const { data: staffUser } = await admin
    .from('staff_users')
    .select('name')
    .eq('id', id).eq('company_id', companyId)
    .single()

  const { error } = await admin
    .from('staff_users')
    .update({ is_active: false })
    .eq('id', id).eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    action:     'staff.deleted',
    entityType: 'staff_users',
    entityId:   id,
    newValue:   { name: staffUser?.name },
  })
  return NextResponse.json({ ok: true })
}
