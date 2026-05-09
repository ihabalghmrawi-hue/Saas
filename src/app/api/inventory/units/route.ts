import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import type { BusinessType } from '@/lib/features'

const UNIT_SEEDS: Record<string, { name: string; name_ar: string; abbreviation: string }[]> = {
  retail: [
    { name: 'piece',   name_ar: 'قطعة',       abbreviation: 'قطعة'  },
    { name: 'box',     name_ar: 'علبة',        abbreviation: 'علبة'  },
    { name: 'carton',  name_ar: 'كرتون',       abbreviation: 'كرتون' },
    { name: 'bag',     name_ar: 'كيس',         abbreviation: 'كيس'   },
    { name: 'kg',      name_ar: 'كيلوغرام',    abbreviation: 'كجم'   },
    { name: 'gram',    name_ar: 'غرام',         abbreviation: 'غرام'  },
    { name: 'liter',   name_ar: 'لتر',          abbreviation: 'لتر'   },
    { name: 'ml',      name_ar: 'مليلتر',       abbreviation: 'مل'    },
    { name: 'bottle',  name_ar: 'زجاجة',        abbreviation: 'زجاجة' },
    { name: 'bundle',  name_ar: 'رزمة',         abbreviation: 'رزمة'  },
    { name: 'dozen',   name_ar: 'دستة',         abbreviation: 'دستة'  },
    { name: 'pack',    name_ar: 'باكيت',        abbreviation: 'باكيت' },
  ],
  pharmacy: [
    { name: 'tablet',  name_ar: 'قرص / حبة',    abbreviation: 'قرص'   },
    { name: 'box',     name_ar: 'علبة',          abbreviation: 'علبة'  },
    { name: 'bottle',  name_ar: 'زجاجة',         abbreviation: 'زجاجة' },
    { name: 'ampoule', name_ar: 'أمبول',         abbreviation: 'أمبول' },
    { name: 'tube',    name_ar: 'أنبوب / كريم',  abbreviation: 'أنبوب' },
    { name: 'sachet',  name_ar: 'كيس',           abbreviation: 'كيس'   },
    { name: 'ml',      name_ar: 'مليلتر',        abbreviation: 'مل'    },
    { name: 'mg',      name_ar: 'ملغرام',        abbreviation: 'ملغ'   },
    { name: 'capsule', name_ar: 'كبسولة',        abbreviation: 'كبسولة'},
    { name: 'vial',    name_ar: 'قارورة',        abbreviation: 'قارورة'},
    { name: 'unit',    name_ar: 'وحدة دولية',   abbreviation: 'وحدة'  },
  ],
  clothing: [
    { name: 'piece', name_ar: 'قطعة', abbreviation: 'قطعة' },
    { name: 'set',   name_ar: 'طقم',  abbreviation: 'طقم'  },
    { name: 'pair',  name_ar: 'جوز',  abbreviation: 'جوز'  },
    { name: 'pack',  name_ar: 'باكيت',abbreviation: 'باكيت'},
    { name: 'dozen', name_ar: 'دستة', abbreviation: 'دستة' },
  ],
  wholesale: [
    { name: 'carton', name_ar: 'كرتون',    abbreviation: 'كرتون' },
    { name: 'ton',    name_ar: 'طن',        abbreviation: 'طن'    },
    { name: 'kg',     name_ar: 'كيلوغرام', abbreviation: 'كجم'   },
    { name: 'liter',  name_ar: 'لتر',       abbreviation: 'لتر'   },
    { name: 'barrel', name_ar: 'برميل',     abbreviation: 'برميل' },
    { name: 'bag',    name_ar: 'كيس',       abbreviation: 'كيس'   },
    { name: 'pallet', name_ar: 'منصة',      abbreviation: 'منصة'  },
    { name: 'piece',  name_ar: 'قطعة',      abbreviation: 'قطعة'  },
    { name: 'meter',  name_ar: 'متر',       abbreviation: 'م'     },
    { name: 'sqm',    name_ar: 'متر مربع',  abbreviation: 'م²'    },
  ],
  stationery: [
    { name: 'piece',  name_ar: 'قطعة',     abbreviation: 'قطعة'  },
    { name: 'bundle', name_ar: 'رزمة',     abbreviation: 'رزمة'  },
    { name: 'box',    name_ar: 'صندوق',    abbreviation: 'صندوق' },
    { name: 'dozen',  name_ar: 'دستة',     abbreviation: 'دستة'  },
    { name: 'roll',   name_ar: 'رول',       abbreviation: 'رول'   },
    { name: 'sheet',  name_ar: 'ورقة',      abbreviation: 'ورقة'  },
    { name: 'pack',   name_ar: 'باكيت',    abbreviation: 'باكيت' },
  ],
  tools: [
    { name: 'piece',  name_ar: 'قطعة',     abbreviation: 'قطعة'  },
    { name: 'set',    name_ar: 'مجموعة',   abbreviation: 'مجموعة'},
    { name: 'kg',     name_ar: 'كيلوغرام', abbreviation: 'كجم'   },
    { name: 'meter',  name_ar: 'متر',      abbreviation: 'م'     },
    { name: 'liter',  name_ar: 'لتر',      abbreviation: 'لتر'   },
    { name: 'roll',   name_ar: 'رول',      abbreviation: 'رول'   },
    { name: 'sqm',    name_ar: 'متر مربع', abbreviation: 'م²'    },
    { name: 'bag',    name_ar: 'كيس',      abbreviation: 'كيس'   },
  ],
  other: [
    { name: 'piece',  name_ar: 'قطعة',     abbreviation: 'قطعة' },
    { name: 'box',    name_ar: 'علبة',      abbreviation: 'علبة' },
    { name: 'kg',     name_ar: 'كيلوغرام', abbreviation: 'كجم'  },
    { name: 'liter',  name_ar: 'لتر',      abbreviation: 'لتر'  },
    { name: 'hour',   name_ar: 'ساعة',     abbreviation: 'ساعة' },
    { name: 'day',    name_ar: 'يوم',      abbreviation: 'يوم'  },
  ],
}

UNIT_SEEDS.dress_rental = UNIT_SEEDS.clothing

export async function GET() {
  const supabase  = createClient()
  const companyId = getCompanyId()
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('company_id', companyId)
    .order('name_ar')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const body      = await req.json()

  if (body.action === 'seed') {
    const bt    = (body.businessType as BusinessType) || 'retail'
    const seeds = UNIT_SEEDS[bt] || UNIT_SEEDS.other
    const { error } = await admin.from('units').insert(
      seeds.map(s => ({ ...s, company_id: companyId }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, count: seeds.length })
  }

  const { name, name_ar, abbreviation } = body
  if (!name && !name_ar) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
  const { data, error } = await admin.from('units').insert({
    company_id: companyId,
    name:         name         || name_ar,
    name_ar:      name_ar      || name,
    abbreviation: abbreviation || name_ar || name,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const { id }    = await req.json()
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })
  const { error } = await admin.from('units').delete().eq('id', id).eq('company_id', companyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
