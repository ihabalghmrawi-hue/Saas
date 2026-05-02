import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { Toaster } from '@/components/ui/toaster'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'القسم المالي - إدارة مالية ذكية',
    template: '%s | القسم المالي',
  },
  description: 'نظام إدارة مالية متكامل للشركات والمؤسسات',
  keywords: ['محاسبة', 'إدارة مالية', 'فواتير', 'تقارير'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
