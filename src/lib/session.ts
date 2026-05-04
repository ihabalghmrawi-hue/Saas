// Session signing using HMAC-SHA256 (available in Node.js + Edge runtime)

const SESSION_COOKIE = 'erp_staff_session'
const SESSION_SECRET = process.env.SESSION_SECRET || 'erp-default-secret-change-in-production'

export interface StaffSession {
  id: string
  name: string
  role: string        // 'admin' | 'manager' | 'cashier' | custom
  permissions: string[]
  companyId: string
  loginAt: number
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function signSession(payload: StaffSession): Promise<string> {
  const data = btoa(encodeURIComponent(JSON.stringify(payload)))
  const key = await getKey(SESSION_SECRET)
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${data}.${sigHex}`
}

export async function verifySession(token: string): Promise<StaffSession | null> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return null
    const data = token.slice(0, dotIdx)
    const sigHex = token.slice(dotIdx + 1)

    const key = await getKey(SESSION_SECRET)
    const sigBytes = new Uint8Array(
      sigHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
    )
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
    if (!valid) return null

    const payload = JSON.parse(decodeURIComponent(atob(data))) as StaffSession
    return payload
  } catch {
    return null
  }
}

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin + SESSION_SECRET))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export { SESSION_COOKIE }
