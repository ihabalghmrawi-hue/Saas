import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_TYPES, type BusinessType } from '@/lib/features'
import { getCompanyId } from '@/lib/tenant'

// ── Seed templates per business type ─────────────────────────────────────────

interface Category { name: string; name_ar: string; color: string; icon?: string }
interface Product  { name: string; name_ar: string; price: number; cost_price?: number; unit?: string; category_key: string }

const TEMPLATES: Record<BusinessType, { categories: Category[]; products: Product[] }> = {

  clothing: {
    categories: [
      { name: 'Mens',       name_ar: 'رجالي',        color: '#3B82F6' },
      { name: 'Womens',     name_ar: 'حريمي',         color: '#EC4899' },
      { name: 'Kids',       name_ar: 'أطفال',         color: '#F59E0B' },
      { name: 'Sports',     name_ar: 'رياضي',         color: '#10B981' },
      { name: 'Underwear',  name_ar: 'ملابس داخلية',  color: '#8B5CF6' },
      { name: 'Accessories',name_ar: 'إكسسوارات',     color: '#F97316' },
    ],
    products: [
      { name: 'Mens Shirt S',    name_ar: 'قميص رجالي S',      price: 89,  cost_price: 45, unit: 'قطعة', category_key: 'Mens' },
      { name: 'Mens Shirt M',    name_ar: 'قميص رجالي M',      price: 89,  cost_price: 45, unit: 'قطعة', category_key: 'Mens' },
      { name: 'Mens Shirt L',    name_ar: 'قميص رجالي L',      price: 89,  cost_price: 45, unit: 'قطعة', category_key: 'Mens' },
      { name: 'Mens Pants 30',   name_ar: 'بنطلون رجالي 30',   price: 149, cost_price: 75, unit: 'قطعة', category_key: 'Mens' },
      { name: 'Mens Pants 32',   name_ar: 'بنطلون رجالي 32',   price: 149, cost_price: 75, unit: 'قطعة', category_key: 'Mens' },
      { name: 'Womens Dress S',  name_ar: 'فستان حريمي S',     price: 199, cost_price: 95, unit: 'قطعة', category_key: 'Womens' },
      { name: 'Womens Dress M',  name_ar: 'فستان حريمي M',     price: 199, cost_price: 95, unit: 'قطعة', category_key: 'Womens' },
      { name: 'Womens Abaya',    name_ar: 'عباءة',             price: 249, cost_price: 120,unit: 'قطعة', category_key: 'Womens' },
      { name: 'Kids T-Shirt 4',  name_ar: 'تيشيرت أطفال 4',   price: 49,  cost_price: 22, unit: 'قطعة', category_key: 'Kids' },
      { name: 'Kids Pants 6',    name_ar: 'بنطلون أطفال 6',    price: 69,  cost_price: 32, unit: 'قطعة', category_key: 'Kids' },
      { name: 'Sports Jogger M', name_ar: 'جوجر رياضي M',      price: 129, cost_price: 60, unit: 'قطعة', category_key: 'Sports' },
      { name: 'Sports Jogger L', name_ar: 'جوجر رياضي L',      price: 129, cost_price: 60, unit: 'قطعة', category_key: 'Sports' },
      { name: 'Belt',            name_ar: 'حزام',              price: 39,  cost_price: 15, unit: 'قطعة', category_key: 'Accessories' },
      { name: 'Cap',             name_ar: 'قبعة',              price: 49,  cost_price: 20, unit: 'قطعة', category_key: 'Accessories' },
    ],
  },

  pharmacy: {
    categories: [
      { name: 'Medicines',   name_ar: 'أدوية',              color: '#EF4444' },
      { name: 'Vitamins',    name_ar: 'فيتامينات ومكملات',  color: '#F59E0B' },
      { name: 'Baby',        name_ar: 'منتجات الأطفال',      color: '#EC4899' },
      { name: 'Cosmetics',   name_ar: 'مستحضرات تجميل',     color: '#8B5CF6' },
      { name: 'Medical',     name_ar: 'مستلزمات طبية',      color: '#3B82F6' },
      { name: 'Herbs',       name_ar: 'أعشاب وتكميلية',     color: '#10B981' },
    ],
    products: [
      { name: 'Panadol 500mg',   name_ar: 'بنادول 500',         price: 8,   cost_price: 4,  unit: 'علبة', category_key: 'Medicines' },
      { name: 'Brufen 400mg',    name_ar: 'بروفين 400',          price: 12,  cost_price: 6,  unit: 'علبة', category_key: 'Medicines' },
      { name: 'Amoxicillin 500', name_ar: 'أموكسيسيلين 500',    price: 18,  cost_price: 9,  unit: 'علبة', category_key: 'Medicines' },
      { name: 'Vitamin C 1000',  name_ar: 'فيتامين سي 1000',    price: 22,  cost_price: 10, unit: 'علبة', category_key: 'Vitamins' },
      { name: 'Vitamin D3',      name_ar: 'فيتامين D3',          price: 35,  cost_price: 16, unit: 'علبة', category_key: 'Vitamins' },
      { name: 'Zinc 50mg',       name_ar: 'زنك 50 مجم',          price: 20,  cost_price: 9,  unit: 'علبة', category_key: 'Vitamins' },
      { name: 'Baby Diapers S',  name_ar: 'حفاضات أطفال S',     price: 45,  cost_price: 28, unit: 'علبة', category_key: 'Baby' },
      { name: 'Baby Milk 400g',  name_ar: 'حليب أطفال 400',     price: 55,  cost_price: 35, unit: 'علبة', category_key: 'Baby' },
      { name: 'Face Cream 50ml', name_ar: 'كريم وجه 50 مل',     price: 29,  cost_price: 12, unit: 'قطعة', category_key: 'Cosmetics' },
      { name: 'Surgical Mask',   name_ar: 'كمامة طبية',         price: 15,  cost_price: 6,  unit: 'علبة', category_key: 'Medical' },
      { name: 'Blood Pressure Monitor', name_ar: 'جهاز ضغط دم', price: 120, cost_price: 70, unit: 'جهاز', category_key: 'Medical' },
    ],
  },

  retail: {
    categories: [
      { name: 'Food',        name_ar: 'مواد غذائية',   color: '#F59E0B' },
      { name: 'Beverages',   name_ar: 'مشروبات',       color: '#3B82F6' },
      { name: 'Dairy',       name_ar: 'منتجات ألبان',  color: '#10B981' },
      { name: 'Cleaning',    name_ar: 'منظفات',        color: '#8B5CF6' },
      { name: 'Personal',    name_ar: 'عناية شخصية',  color: '#EC4899' },
      { name: 'Snacks',      name_ar: 'وجبات خفيفة',  color: '#EF4444' },
    ],
    products: [
      { name: 'Rice 5kg',        name_ar: 'أرز 5 كيلو',       price: 25,  cost_price: 18, unit: 'كيلو',  category_key: 'Food' },
      { name: 'Sugar 1kg',       name_ar: 'سكر 1 كيلو',       price: 5,   cost_price: 3.5,unit: 'كيلو',  category_key: 'Food' },
      { name: 'Flour 2kg',       name_ar: 'دقيق 2 كيلو',      price: 8,   cost_price: 5,  unit: 'كيلو',  category_key: 'Food' },
      { name: 'Cooking Oil 1L',  name_ar: 'زيت طهي 1 لتر',    price: 12,  cost_price: 8,  unit: 'لتر',   category_key: 'Food' },
      { name: 'Water 1.5L',      name_ar: 'ماء معدني 1.5 لتر', price: 1.5, cost_price: 0.7,unit: 'زجاجة', category_key: 'Beverages' },
      { name: 'Pepsi 330ml',     name_ar: 'بيبسي 330 مل',     price: 3,   cost_price: 1.8,unit: 'علبة',  category_key: 'Beverages' },
      { name: 'Milk 1L',         name_ar: 'حليب 1 لتر',       price: 6,   cost_price: 4,  unit: 'لتر',   category_key: 'Dairy' },
      { name: 'Cheese 200g',     name_ar: 'جبن 200 غرام',     price: 9,   cost_price: 6,  unit: 'قطعة',  category_key: 'Dairy' },
      { name: 'Dishwash 750ml',  name_ar: 'سائل جلي 750 مل',  price: 8,   cost_price: 5,  unit: 'زجاجة', category_key: 'Cleaning' },
      { name: 'Chips Large',     name_ar: 'شيبس كبير',        price: 4,   cost_price: 2.5,unit: 'علبة',  category_key: 'Snacks' },
      { name: 'Chocolate Bar',   name_ar: 'شوكولاتة',         price: 3.5, cost_price: 2,  unit: 'قطعة',  category_key: 'Snacks' },
    ],
  },

  wholesale: {
    categories: [
      { name: 'Food Bulk',    name_ar: 'مواد غذائية بالجملة', color: '#F59E0B' },
      { name: 'Beverages',    name_ar: 'مشروبات',             color: '#3B82F6' },
      { name: 'Clothing',     name_ar: 'ملابس بالجملة',       color: '#EC4899' },
      { name: 'Electronics',  name_ar: 'إلكترونيات',          color: '#6366F1' },
      { name: 'Cleaning',     name_ar: 'منظفات بالجملة',      color: '#8B5CF6' },
    ],
    products: [
      { name: 'Rice 50kg Bag',   name_ar: 'أرز 50 كيلو',         price: 220, cost_price: 180,unit: 'كيس',  category_key: 'Food Bulk' },
      { name: 'Sugar 50kg',      name_ar: 'سكر 50 كيلو',         price: 180, cost_price: 150,unit: 'كيس',  category_key: 'Food Bulk' },
      { name: 'Oil 16L Carton',  name_ar: 'زيت 16 لتر كرتون',   price: 180, cost_price: 145,unit: 'كرتون',category_key: 'Food Bulk' },
      { name: 'Water Carton',    name_ar: 'ماء كرتون 12×1.5',    price: 15,  cost_price: 10, unit: 'كرتون',category_key: 'Beverages' },
      { name: 'Soda Carton 24',  name_ar: 'مشروبات كرتون 24',    price: 55,  cost_price: 42, unit: 'كرتون',category_key: 'Beverages' },
      { name: 'T-Shirts Dozen',  name_ar: 'تيشيرت دزينة',       price: 280, cost_price: 200,unit: 'دزينة', category_key: 'Clothing' },
      { name: 'Socks Dozen',     name_ar: 'جوارب دزينة',        price: 60,  cost_price: 40, unit: 'دزينة', category_key: 'Clothing' },
      { name: 'Detergent 10kg',  name_ar: 'مسحوق غسيل 10 كيلو', price: 85,  cost_price: 65, unit: 'كيس',  category_key: 'Cleaning' },
    ],
  },

  stationery: {
    categories: [
      { name: 'Pens',        name_ar: 'أقلام',              color: '#3B82F6' },
      { name: 'Paper',       name_ar: 'أوراق ودفاتر',       color: '#F59E0B' },
      { name: 'Bags',        name_ar: 'حقائب مدرسية',       color: '#EC4899' },
      { name: 'Art',         name_ar: 'أدوات رسم وفن',      color: '#8B5CF6' },
      { name: 'Office',      name_ar: 'مستلزمات مكتبية',    color: '#10B981' },
    ],
    products: [
      { name: 'Blue Pen',         name_ar: 'قلم جاف أزرق',       price: 1,   cost_price: 0.4, unit: 'قطعة', category_key: 'Pens' },
      { name: 'Pencil HB',        name_ar: 'قلم رصاص HB',        price: 0.75,cost_price: 0.3, unit: 'قطعة', category_key: 'Pens' },
      { name: 'Highlighter Set',  name_ar: 'أقلام تحديد',        price: 8,   cost_price: 4,   unit: 'طقم',  category_key: 'Pens' },
      { name: 'A4 Paper 500',     name_ar: 'ورق A4 رزمة',        price: 18,  cost_price: 12,  unit: 'رزمة', category_key: 'Paper' },
      { name: 'Notebook 100p',    name_ar: 'دفتر 100 ورقة',      price: 5,   cost_price: 2.5, unit: 'قطعة', category_key: 'Paper' },
      { name: 'School Bag Sm',    name_ar: 'حقيبة مدرسة صغيرة',  price: 45,  cost_price: 25,  unit: 'قطعة', category_key: 'Bags' },
      { name: 'School Bag Lg',    name_ar: 'حقيبة مدرسة كبيرة',  price: 75,  cost_price: 42,  unit: 'قطعة', category_key: 'Bags' },
      { name: 'Stapler',          name_ar: 'دباسة',              price: 15,  cost_price: 8,   unit: 'قطعة', category_key: 'Office' },
      { name: 'Scissors',         name_ar: 'مقص',                price: 7,   cost_price: 3,   unit: 'قطعة', category_key: 'Office' },
      { name: 'Color Pencils 24', name_ar: 'أقلام تلوين 24 لون', price: 12,  cost_price: 6,   unit: 'علبة', category_key: 'Art' },
    ],
  },

  tools: {
    categories: [
      { name: 'Hand Tools',    name_ar: 'أدوات يدوية',     color: '#F59E0B' },
      { name: 'Power Tools',   name_ar: 'أدوات كهربائية',  color: '#EF4444' },
      { name: 'Plumbing',      name_ar: 'أدوات سباكة',     color: '#3B82F6' },
      { name: 'Electrical',    name_ar: 'أدوات كهرباء',    color: '#F97316' },
      { name: 'Paint',         name_ar: 'دهانات',          color: '#8B5CF6' },
      { name: 'Safety',        name_ar: 'معدات سلامة',     color: '#10B981' },
    ],
    products: [
      { name: 'Hammer 500g',   name_ar: 'مطرقة 500 غرام',    price: 25,  cost_price: 14, unit: 'قطعة', category_key: 'Hand Tools' },
      { name: 'Screwdriver Set', name_ar: 'طقم مفكات',       price: 35,  cost_price: 18, unit: 'طقم',  category_key: 'Hand Tools' },
      { name: 'Wrench 12"',    name_ar: 'مفتاح ربط 12 بوصة', price: 45,  cost_price: 25, unit: 'قطعة', category_key: 'Hand Tools' },
      { name: 'Drill 500W',    name_ar: 'مثقاب كهربائي 500W', price: 180, cost_price: 110,unit: 'قطعة', category_key: 'Power Tools' },
      { name: 'Grinder 800W',  name_ar: 'جلاخة 800W',        price: 220, cost_price: 140,unit: 'قطعة', category_key: 'Power Tools' },
      { name: 'PVC Pipe 3m',   name_ar: 'أنبوب PVC 3 متر',   price: 18,  cost_price: 10, unit: 'قطعة', category_key: 'Plumbing' },
      { name: 'Cable 2.5mm 10m',name_ar: 'سلك 2.5 مم 10 متر',price: 28,  cost_price: 16, unit: 'متر',  category_key: 'Electrical' },
      { name: 'White Paint 4L',name_ar: 'دهان أبيض 4 لتر',   price: 55,  cost_price: 32, unit: 'علبة', category_key: 'Paint' },
      { name: 'Safety Helmet', name_ar: 'خوذة أمان',          price: 30,  cost_price: 15, unit: 'قطعة', category_key: 'Safety' },
    ],
  },

  dress_rental: {
    categories: [
      { name: 'Wedding',       name_ar: 'فساتين زفاف',        color: '#EC4899' },
      { name: 'Evening',       name_ar: 'فساتين سهرة',        color: '#8B5CF6' },
      { name: 'Traditional',   name_ar: 'ملابس تراثية',        color: '#F59E0B' },
      { name: 'Accessories',   name_ar: 'إكسسوارات',          color: '#F97316' },
    ],
    products: [
      { name: 'Wedding Dress A', name_ar: 'فستان زفاف A',    price: 300, cost_price: 0,  unit: 'يوم', category_key: 'Wedding' },
      { name: 'Wedding Dress B', name_ar: 'فستان زفاف B',    price: 400, cost_price: 0,  unit: 'يوم', category_key: 'Wedding' },
      { name: 'Evening Dress 1', name_ar: 'فستان سهرة 1',    price: 150, cost_price: 0,  unit: 'يوم', category_key: 'Evening' },
      { name: 'Evening Dress 2', name_ar: 'فستان سهرة 2',    price: 200, cost_price: 0,  unit: 'يوم', category_key: 'Evening' },
      { name: 'Traditional 1',   name_ar: 'زي تراثي 1',      price: 120, cost_price: 0,  unit: 'يوم', category_key: 'Traditional' },
      { name: 'Jewelry Set',     name_ar: 'طقم مجوهرات',     price: 80,  cost_price: 0,  unit: 'يوم', category_key: 'Accessories' },
    ],
  },

  other: {
    categories: [
      { name: 'Category 1', name_ar: 'فئة 1', color: '#3B82F6' },
      { name: 'Category 2', name_ar: 'فئة 2', color: '#10B981' },
      { name: 'Category 3', name_ar: 'فئة 3', color: '#F59E0B' },
    ],
    products: [
      { name: 'Product 1', name_ar: 'منتج 1', price: 50,  cost_price: 30, unit: 'قطعة', category_key: 'Category 1' },
      { name: 'Product 2', name_ar: 'منتج 2', price: 100, cost_price: 60, unit: 'قطعة', category_key: 'Category 2' },
      { name: 'Product 3', name_ar: 'منتج 3', price: 150, cost_price: 90, unit: 'قطعة', category_key: 'Category 3' },
    ],
  },
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  try {
    const { business_type, reset = false } = await req.json()

    if (!BUSINESS_TYPES.includes(business_type as BusinessType)) {
      return NextResponse.json({ error: 'نوع نشاط غير صالح' }, { status: 400 })
    }

    const supabase  = createClient()
    const template  = TEMPLATES[business_type as BusinessType]

    // ── If reset: clear existing data ──────────────────────────────────────
    if (reset) {
      await supabase.from('sale_items').delete().in(
        'sale_id',
        (await supabase.from('sales').select('id').eq('company_id', COMPANY_ID)).data?.map((r: any) => r.id) || []
      )
      await supabase.from('products').delete().eq('company_id', COMPANY_ID).eq('is_system_default', true)
      await supabase.from('product_categories').delete().eq('company_id', COMPANY_ID).eq('is_system_default', true)
    }

    // ── Insert categories ──────────────────────────────────────────────────
    const categoryMap: Record<string, string> = {}
    for (const cat of template.categories) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('product_categories')
        .select('id')
        .eq('company_id', COMPANY_ID)
        .eq('name', cat.name)
        .maybeSingle()

      if (existing) {
        categoryMap[cat.name] = existing.id
        continue
      }

      const insertPayload: Record<string, unknown> = {
        company_id:       COMPANY_ID,
        name:             cat.name,
        name_ar:          cat.name_ar,
        color:            cat.color,
        is_active:        true,
        is_system_default: true,
      }

      const { data: newCat } = await supabase
        .from('product_categories')
        .insert(insertPayload)
        .select('id')
        .single()

      if (newCat) categoryMap[cat.name] = newCat.id
    }

    // ── Insert products ────────────────────────────────────────────────────
    let inserted = 0
    for (const prod of template.products) {
      const category_id = categoryMap[prod.category_key] || null

      // Skip if already exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('company_id', COMPANY_ID)
        .eq('name', prod.name)
        .maybeSingle()

      if (existing) continue

      const productPayload: Record<string, unknown> = {
        company_id:        COMPANY_ID,
        name:              prod.name,
        name_ar:           prod.name_ar,
        price:             prod.price,
        cost_price:        prod.cost_price ?? 0,
        category_id,
        type:              'product',
        is_active:         true,
        is_system_default: true,
        ...(prod.unit ? { unit: prod.unit } : {}),
      }

      const { data: newProd } = await supabase
        .from('products')
        .insert(productPayload)
        .select('id')
        .single()

      if (newProd) inserted++
    }

    return NextResponse.json({
      success: true,
      business_type,
      categories_seeded: Object.keys(categoryMap).length,
      products_seeded:   inserted,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
