// GET /api/trash?module=sales&type=customer&limit=100
import { NextRequest, NextResponse } from 'next/server'
import { listTrash } from '@/lib/data-lifecycle'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  const sp     = req.nextUrl.searchParams
  const module = sp.get('module') || undefined
  const type   = sp.get('type')   || undefined
  const limit  = Math.min(200, parseInt(sp.get('limit') || '100'))

  const items = await listTrash(COMPANY_ID, module, type, limit)
  return NextResponse.json(items)
}
