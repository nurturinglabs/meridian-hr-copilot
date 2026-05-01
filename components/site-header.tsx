'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { setPersonaAction, setRegionAction } from '@/app/actions'
import type { Persona, Region } from '@/lib/personas'

const TABS = [
  { href: '/copilot', label: 'Copilot' },
  { href: '/governance', label: 'Governance' },
  { href: '/evals', label: 'Evals' },
] as const

export function SiteHeader({
  persona,
  region,
}: {
  persona: Persona
  region: Region
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <Link href="/copilot" className="text-lg font-semibold tracking-tight">
            Meridian <span className="text-emerald-400">HR Copilot</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <SelectControl
            label="Persona"
            value={persona}
            disabled={pending}
            options={[
              { value: 'employee', label: 'Employee' },
              { value: 'hr_admin', label: 'HR Admin' },
              { value: 'executive', label: 'Executive' },
            ]}
            onChange={(v) =>
              startTransition(async () => {
                await setPersonaAction(v as Persona)
                router.refresh()
              })
            }
          />
          <SelectControl
            label="Region"
            value={region}
            disabled={pending}
            options={[
              { value: 'ALL', label: 'ALL' },
              { value: 'WI', label: 'WI' },
              { value: 'NY', label: 'NY' },
            ]}
            onChange={(v) =>
              startTransition(async () => {
                await setRegionAction(v as Region)
                router.refresh()
              })
            }
          />
        </div>
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

function SelectControl({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-md px-2 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[hsl(var(--card))]">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
