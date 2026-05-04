import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('logo') as File
    if (!file) return NextResponse.json({ error: 'لا يوجد ملف' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'الحجم الأقصى 2MB' }, { status: 400 })
    }

    const supabase = createClient()
    const path = `${COMPANY_ID}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) throw new Error(uploadError.message)

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)

    // Save to branding
    await supabase.from('branding').upsert({
      company_id: COMPANY_ID,
      logo_url: publicUrl,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({ url: publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
