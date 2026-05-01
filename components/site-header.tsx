'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/copilot', label: 'Copilot' },
  { href: '/governance', label: 'Governance' },
  { href: '/evals', label: 'Evals' },
] as const

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <Link href="/copilot" className="text-lg font-semibold tracking-tight">
          Meridian <span className="text-emerald-400">HR Copilot</span>
        </Link>

        {/* room for top-bar links — drop them in here */}
        <div className="flex items-center gap-4 text-sm" />
      </div>
      <nav className="max-w-7xl mx-auto px-6 flex gap-1">
        {TABS.map((t) => {
          const active = pathname?.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                active
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              ].join(' ')}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
