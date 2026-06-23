import type { Metadata } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

// Кирилиця обовʼязкова — UI українською
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans', display: 'swap' })
const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Атлеті',
  description: 'Платформа для тренерів і клієнтів',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="min-h-screen bg-atleti-bg text-atleti-ink font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
