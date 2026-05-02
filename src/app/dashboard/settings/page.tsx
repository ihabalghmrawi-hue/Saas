import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('*, companies(*)')
    .eq('user_id', user!.id)
    .single()

  const company = membership?.companies as any

  return (
    <SettingsClient
      company={company}
      user={user!}
      role={membership?.role || 'viewer'}
    />
  )
}
