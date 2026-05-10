import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OnboardingClient from './onboarding-client'

export default async function OnboardingPage() {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check if user already has a company with business_type set
    const { data: membership } = await supabase
      .from('memberships')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (membership?.company_id) {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('business_type')
        .eq('company_id', membership.company_id)
        .maybeSingle()

      // Business type already chosen — lock them out of onboarding
      if (settings?.business_type) {
        redirect('/dashboard')
      }
    }
  }

  return <OnboardingClient />
}
