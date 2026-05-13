import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'
import { logAudit } from '@/lib/audit'

const BUCKET = 'logos'

export async function POST(req: NextRequest) {
  const COMPANY_ID = await getCompanyId()
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

    const admin = createAdminClient()

    // Ensure bucket exists
    const { data: buckets } = await admin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === BUCKET)
    if (!bucketExists) {
      const { error: bucketErr } = await admin.storage.createBucket(BUCKET, { public: true })
      if (bucketErr) throw new Error(`فشل إنشاء مخزن الملفات: ${bucketErr.message}`)
    }

    const path = `${COMPANY_ID}/logo.${ext}`
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) throw new Error(uploadError.message)

    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)

    await admin.from('branding').upsert({
      company_id: COMPANY_ID,
      logo_url:   publicUrl,
      updated_at: new Date().toISOString(),
    })

    await logAudit({ action: 'branding.updated', entityType: 'branding', entityId: COMPANY_ID })

    return NextResponse.json({ url: publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
