import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SiteHeader } from '@/components/site-header'
import { getPersona, getRegion } from '@/lib/personas'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Meridian HR Copilot',
  description:
    'A portfolio demo of enterprise-grade AI-ready content engineering, privacy-safe retrieval, and retrieval quality measurement.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const persona = getPersona()
  const region = getRegion()

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <SiteHeader persona={persona} region={region} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
          {children}
        </main>
        <footer className="border-t border-[hsl(var(--border))] py-4 text-xs text-[hsl(var(--muted-foreground))]">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
            <span>
              Built by Umesh Narayanappa ·{' '}
              <a
                href="https://github.com/nurturinglabs"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-orange-400"
              >
                GitHub
              </a>
            </span>
            <span className="font-mono">Meridian Mutual is fictional.</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
