import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

const DEFAULT_CATEGORIES = [
  { name: 'salaries',   name_ar: 'مرتبات وأجور',   color: '#3b82f6', icon: 'users'       },
  { name: 'rent',       name_ar: 'إيجار',           color: '#8b5cf6', icon: 'home'        },
  { name: 'utilities',  name_ar: 'فواتير وخدمات',   color: '#f59e0b', icon: 'zap'         },
  { name: 'supplies',   name_ar: 'مستلزمات',        color: '#10b981', icon: 'package'     },
  { name: 'marketing',  name_ar: 'تسويق وإعلان',    color: '#ec4899', icon: 'megaphone'   },
  { name: 'transport',  name_ar: 'نقل ومواصلات',    color: '#6366f1', icon: 'truck'       },
  { name: 'maintenance',name_ar: 'صيانة وإصلاح',    color: '#f97316', icon: 'wrench'      },
  { name: 'other',      name_ar: 'مصروفات أخرى',    color: '#94a3b8', icon: 'more-horizontal' },
]

export async function GET() {
  const companyId = getCompanyId()
  const supabase  = createClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name_ar')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const companyId = getCompanyId()
  const admin     = createAdminClient()
  const body      = await req.json()

  // Seed default categories
  if (body.action === 'seed') {
    const { data: existing } = await admin.from('expense_categories').select('name').eq('company_id', companyId)
    const existingNames = new Set((existing || []).map((c: any) => c.name))
    const toInsert = DEFAULT_CATEGORIES.filter(c => !existingNames.has(c.name)).map(c => ({ ...c, company_id: companyId }))
    if (toInsert.length > 0) {
      await admin.from('expense_categories').insert(toInsert)
    }
    return NextResponse.json({ seeded: toInsert.length })
  }

  if (!body.name_ar) return NextResponse.json({ error: 'اسم الفئة مطلوب' }, { status: 400 })

  const { data, error } = await admin.from('expense_categories').insert({
    company_id: companyId,
    name:       body.name || body.name_ar.toLowerCase().replace(/\s+/g, '_'),
    name_ar:    body.name_ar.trim(),
    color:      body.color || '#6366f1',
    icon:       body.icon  || 'tag',
    is_active:  true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const companyId = getCompanyId()
  const admin     = createAdminClient()
  const { id }    = await req.json()

  const { error } = await admin.from('expense_categories')
    .update({ is_active: false })
    .eq('id', id).eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
