import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import type { BusinessType } from '@/lib/features'

// Default product categories per business domain
const CATEGORY_SEEDS: Record<string, { name: string; name_ar: string; color: string; icon: string }[]> = {
  retail: [
    { name: 'food',          name_ar: 'مواد غذائية',      color: '#10b981', icon: 'shopping-cart' },
    { name: 'beverages',     name_ar: 'مشروبات',           color: '#3b82f6', icon: 'coffee'        },
    { name: 'dairy',         name_ar: 'ألبان ومشتقات',     color: '#f59e0b', icon: 'package'       },
    { name: 'vegetables',    name_ar: 'خضروات وفواكه',     color: '#84cc16', icon: 'package'       },
    { name: 'grains',        name_ar: 'حبوب وبقوليات',    color: '#d97706', icon: 'package'       },
    { name: 'cleaning',      name_ar: 'منظفات',            color: '#06b6d4', icon: 'zap'           },
    { name: 'sweets',        name_ar: 'حلويات ومعجنات',   color: '#ec4899', icon: 'heart'         },
    { name: 'canned',        name_ar: 'معلبات',            color: '#78716c', icon: 'package'       },
    { name: 'frozen',        name_ar: 'مجمدات',            color: '#0ea5e9', icon: 'package'       },
    { name: 'personal_care', name_ar: 'عناية شخصية',      color: '#8b5cf6', icon: 'heart'         },
    { name: 'household',     name_ar: 'أدوات منزلية',     color: '#f97316', icon: 'home'          },
    { name: 'electronics',   name_ar: 'إلكترونيات',        color: '#6366f1', icon: 'zap'           },
  ],
  pharmacy: [
    { name: 'prescription',     name_ar: 'أدوية موصوفة',       color: '#ef4444', icon: 'heart'    },
    { name: 'otc',              name_ar: 'أدوية بدون وصفة',    color: '#f97316', icon: 'heart'    },
    { name: 'medical_supplies', name_ar: 'مستلزمات طبية',      color: '#3b82f6', icon: 'package'  },
    { name: 'cosmetics',        name_ar: 'مستحضرات تجميل',    color: '#ec4899', icon: 'star'     },
    { name: 'vitamins',         name_ar: 'فيتامينات ومكملات',  color: '#10b981', icon: 'zap'      },
    { name: 'medical_devices',  name_ar: 'أجهزة طبية',         color: '#6366f1', icon: 'tool'     },
    { name: 'herbal',           name_ar: 'أعشاب وطبيعي',       color: '#84cc16', icon: 'package'  },
    { name: 'baby_care',        name_ar: 'عناية بالطفل',       color: '#f59e0b', icon: 'heart'    },
    { name: 'orthopedic',       name_ar: 'أدوات تقويم العظام', color: '#94a3b8', icon: 'package'  },
    { name: 'dental',           name_ar: 'صحة الأسنان',        color: '#06b6d4', icon: 'heart'    },
  ],
  clothing: [
    { name: 'mens',          name_ar: 'رجالي',             color: '#3b82f6', icon: 'users'       },
    { name: 'womens',        name_ar: 'نسائي',             color: '#ec4899', icon: 'users'       },
    { name: 'kids',          name_ar: 'أطفال',             color: '#f59e0b', icon: 'users'       },
    { name: 'sports',        name_ar: 'رياضي',             color: '#10b981', icon: 'trending-up' },
    { name: 'formal',        name_ar: 'رسمي',              color: '#6366f1', icon: 'briefcase'   },
    { name: 'casual',        name_ar: 'كاجوال',            color: '#78716c', icon: 'package'     },
    { name: 'underwear',     name_ar: 'تحتانيات',          color: '#8b5cf6', icon: 'package'     },
    { name: 'accessories',   name_ar: 'إكسسوارات',         color: '#f97316', icon: 'star'        },
    { name: 'footwear',      name_ar: 'أحذية وشنط',        color: '#d97706', icon: 'package'     },
    { name: 'winter',        name_ar: 'ملابس شتوية',       color: '#0ea5e9', icon: 'package'     },
    { name: 'abaya',         name_ar: 'عباءات وأزياء شرقية', color: '#7c3aed', icon: 'package'   },
    { name: 'swimwear',      name_ar: 'ملابس رياضية مائية', color: '#06b6d4', icon: 'package'   },
  ],
  wholesale: [
    { name: 'raw_materials',   name_ar: 'مواد خام',          color: '#78716c', icon: 'package'       },
    { name: 'finished_goods',  name_ar: 'بضاعة تامة',        color: '#3b82f6', icon: 'package'       },
    { name: 'packaging',       name_ar: 'مواد تعبئة وتغليف', color: '#10b981', icon: 'package'       },
    { name: 'spare_parts',     name_ar: 'قطع غيار',          color: '#f97316', icon: 'tool'          },
    { name: 'electronics',     name_ar: 'إلكترونيات',         color: '#6366f1', icon: 'zap'           },
    { name: 'food_wholesale',  name_ar: 'مواد غذائية جملة',  color: '#f59e0b', icon: 'shopping-cart' },
    { name: 'chemicals',       name_ar: 'مواد كيميائية',     color: '#ef4444', icon: 'zap'           },
    { name: 'textiles',        name_ar: 'أقمشة ومنسوجات',    color: '#ec4899', icon: 'package'       },
  ],
  stationery: [
    { name: 'pens_notebooks',  name_ar: 'أقلام ودفاتر',      color: '#3b82f6', icon: 'file-text' },
    { name: 'paper_printing',  name_ar: 'أوراق وطباعة',      color: '#10b981', icon: 'file-text' },
    { name: 'art_supplies',    name_ar: 'أدوات رسم وفنون',   color: '#ec4899', icon: 'star'      },
    { name: 'office_supplies', name_ar: 'مستلزمات مكتبية',   color: '#6366f1', icon: 'briefcase' },
    { name: 'school_bags',     name_ar: 'حقائب مدرسية',      color: '#f59e0b', icon: 'package'   },
    { name: 'books',           name_ar: 'كتب ومراجع',        color: '#78716c', icon: 'file-text' },
    { name: 'tech_accessories',name_ar: 'إكسسوارات تقنية',   color: '#8b5cf6', icon: 'zap'       },
  ],
  tools: [
    { name: 'power_tools',       name_ar: 'أدوات كهربائية',   color: '#f97316', icon: 'zap'    },
    { name: 'hand_tools',        name_ar: 'أدوات يدوية',      color: '#78716c', icon: 'tool'   },
    { name: 'building_materials',name_ar: 'مواد بناء',        color: '#d97706', icon: 'home'   },
    { name: 'plumbing',          name_ar: 'أدوات سباكة',      color: '#3b82f6', icon: 'tool'   },
    { name: 'electrical',        name_ar: 'لوازم كهربائية',   color: '#f59e0b', icon: 'zap'    },
    { name: 'lighting',          name_ar: 'إضاءة',            color: '#fbbf24', icon: 'zap'    },
    { name: 'paint',             name_ar: 'دهانات',           color: '#10b981', icon: 'package'},
    { name: 'safety',            name_ar: 'معدات أمان',       color: '#ef4444', icon: 'shield' },
  ],
  other: [
    { name: 'general',     name_ar: 'عام',          color: '#78716c', icon: 'package'   },
    { name: 'services',    name_ar: 'خدمات',         color: '#3b82f6', icon: 'briefcase' },
    { name: 'accessories', name_ar: 'إكسسوارات',    color: '#f97316', icon: 'star'      },
    { name: 'digital',     name_ar: 'منتجات رقمية', color: '#6366f1', icon: 'zap'       },
  ],
}

// Retail seeds also apply to some similar types
CATEGORY_SEEDS.dress_rental = CATEGORY_SEEDS.clothing

export async function GET() {
  const supabase   = createClient()
  const companyId  = getCompanyId()
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name_ar')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const body      = await req.json()

  // Seed defaults for a business type
  if (body.action === 'seed') {
    const bt      = (body.businessType as BusinessType) || 'retail'
    const seeds   = CATEGORY_SEEDS[bt] || CATEGORY_SEEDS.other
    const { error } = await admin.from('product_categories').insert(
      seeds.map(s => ({ ...s, company_id: companyId, is_active: true }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, count: seeds.length })
  }

  // Create single category
  const { name, name_ar, color, icon } = body
  if (!name && !name_ar) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
  const { data, error } = await admin.from('product_categories').insert({
    company_id: companyId,
    name:    name    || name_ar,
    name_ar: name_ar || name,
    color:   color   || '#78716c',
    icon:    icon    || 'package',
    is_active: true,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const { id }    = await req.json()
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })
  const { error } = await admin.from('product_categories')
    .update({ is_active: false })
    .eq('id', id).eq('company_id', companyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
