import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordLoginAttempt } from '@/lib/auth-tracking'

export async function POST(req: NextRequest) {
  try {
    const { email, success } = await req.json()
    if (!email || typeof success !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const supabase = createClient()
    await recordLoginAttempt(supabase, email, success, req)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
