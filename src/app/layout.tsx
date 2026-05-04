import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { getBranding, buildThemeCss } from '@/lib/branding'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'نظام ERP',
    template: '%s | ERP',
  },
  description: 'نظام إدارة متكامل للأعمال التجارية',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding()
  const themeCss = buildThemeCss(branding)

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        {branding.logo_url && <link rel="icon" href={branding.logo_url} />}
      </head>
      <body className={`${cairo.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
