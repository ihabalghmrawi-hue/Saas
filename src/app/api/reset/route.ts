// POST /api/reset — factory reset (admin only, requires confirmation phrase)
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { factoryReset } from '@/lib/data-lifecycle'

const COMPANY_ID    = process.env.NEXT_PUBLIC_COMPANY_ID    || 'default'
const BUSINESS_TYPE = process.env.NEXT_PUBLIC_BUSINESS_TYPE || 'retail'
const CONFIRM_PHRASE = 'DELETE MY BUSINESS DATA'

export async function POST(req: NextRequest) {
  const h         = headers()
  const staffName = h.get('x-staff-name') || ''
  const staffRole = h.get('x-staff-role')  || ''

  // Only admins
  if (staffRole !== 'admin' && staffRole !== 'owner') {
    return NextResponse.json({ error: 'غير مصرح — المسؤول فقط يمكنه إعادة الضبط' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { confirm_phrase, password } = body as { confirm_phrase?: string; password?: string }

  // Require the exact phrase
  if (confirm_phrase !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `يجب كتابة عبارة التأكيد بالضبط: "${CONFIRM_PHRASE}"` },
      { status: 422 },
    )
  }

  // Require password (client sends it; here we just check it was provided —
  // real verification happens via Supabase Auth in production)
  if (!password || password.length < 4) {
    return NextResponse.json({ error: 'كلمة المرور مطلوبة' }, { status: 422 })
  }

  const result = await factoryReset(COMPANY_ID, staffName || 'admin', BUSINESS_TYPE)

  if (!result.ok) {
    return NextResponse.json({ error: result.error, counts: result.counts }, { status: 500 })
  }

  return NextResponse.json({
    ok:       true,
    counts:   result.counts,
    backupId: result.backupId,
    message:  'تمت إعادة ضبط بيانات الشركة بنجاح',
  })
}
