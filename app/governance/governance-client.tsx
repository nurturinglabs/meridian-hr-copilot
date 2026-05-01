'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type DocRow = {
  id: string
  title: string
  doc_type: string
  category: string
  version: number
  effective_date: string
  supersedes: string | null
  is_deprecated: boolean
  min_persona: 'employee' | 'hr_admin' | 'executive'
  regions: string[]
  owner: string | null
  last_reviewed: string | null
  raw_markdown: string
  created_at: string
}

type AuditRow = {
  id: string
  ts: string
  persona: 'employee' | 'hr_admin' | 'executive'
  query: string
  retrieved_chunk_ids: string[]
  filtered_out_chunk_ids: string[]
  filter_reasons: Record<string, string>
  pii_redactions: number
  answer: string | null
  citations: string[]
  faithfulness_score: number | null
  latency_ms: number
}

type RightTab = 'doc' | 'audit'

export function GovernanceClient() {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<RightTab>('doc')
  const [auditPersonaFilter, setAuditPersonaFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/content')
      .then((r) => r.json())
      .then((d) => {
        const rows: DocRow[] = d.rows ?? []
        setDocs(rows)
        if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id)
      })
      // intentionally no .catch — surface in UI via empty state
  }, [selectedId])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      const params = new URLSearchParams()
      if (auditPersonaFilter !== 'all') params.set('persona', auditPersonaFilter)
      fetch(`/api/audit?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setAudit(d.rows ?? [])
        })
    }
    load()
    const t = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [auditPersonaFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, DocRow[]>()
    for (const d of docs) {
      if (!map.has(d.category)) map.set(d.category, [])
      map.get(d.category)!.push(d)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [docs])

  const selected = docs.find((d) => d.id === selectedId) ?? null

  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4 h-[calc(100vh-220px)]">
      {/* LEFT: corpus browser */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 overflow-y-auto">
        <header className="px-4 py-3 border-b border-[hsl(var(--border))] sticky top-0 bg-[hsl(var(--card))]/90 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-700/90">
            Corpus
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {docs.length} documents · grouped by category
          </p>
        </header>
        <div className="p-2">
          {grouped.map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {cat.replace(/_/g, ' ')}
              </div>
              <ul>
                {items.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => {
                        setSelectedId(d.id)
                        setTab('doc')
                      }}
                      className={cn(
                        'w-full text-left rounded-md px-2 py-1.5 text-sm flex items-center justify-between gap-2 hover:bg-indigo-600/10',
                        selectedId === d.id && 'bg-indigo-600/15 text-indigo-700',
                        d.is_deprecated && 'line-through text-red-700/80',
                      )}
                    >
                      <span className="truncate">{d.title}</span>
                      <span className="flex gap-1 shrink-0">
                        <Badge tone="muted">{d.doc_type}</Badge>
                        <Badge tone="muted">v{d.version}</Badge>
                        {d.is_deprecated && <Badge tone="danger">deprecated</Badge>}
                        {d.min_persona !== 'employee' && (
                          <Badge tone="warn">{d.min_persona}</Badge>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {docs.length === 0 && (
            <div className="text-sm text-[hsl(var(--muted-foreground))] p-4">
              loading…
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: detail/audit */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 overflow-hidden flex flex-col">
        <header className="border-b border-[hsl(var(--border))] flex items-center gap-1 px-2">
          <TabBtn active={tab === 'doc'} onClick={() => setTab('doc')}>
            Doc Detail
          </TabBtn>
          <TabBtn active={tab === 'audit'} onClick={() => setTab('audit')}>
            Audit Log
            <span className="ml-2 rounded bg-indigo-600/20 text-indigo-700 text-[10px] px-1.5 py-0.5">
              {audit.length}
            </span>
          </TabBtn>
          <div className="flex-1" />
          {tab === 'audit' && (
            <select
              value={auditPersonaFilter}
              onChange={(e) => setAuditPersonaFilter(e.target.value)}
              className="my-1 mr-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-md px-2 py-1 text-xs"
            >
              <option value="all">all personas</option>
              <option value="employee">employee</option>
              <option value="hr_admin">hr_admin</option>
              <option value="executive">executive</option>
            </select>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {tab === 'doc' ? (
            <DocDetail doc={selected} />
          ) : (
            <AuditList rows={audit} />
          )}
        </div>
      </section>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-xs uppercase tracking-wider border-b-2 -mb-px',
        active
          ? 'border-indigo-700 text-indigo-700'
          : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
      )}
    >
      {children}
    </button>
  )
}

function Badge({
  tone,
  children,
}: {
  tone: 'muted' | 'danger' | 'warn' | 'info'
  children: React.ReactNode
}) {
  const styles = {
    muted: 'bg-[hsl(var(--muted))]/60 text-[hsl(var(--muted-foreground))]',
    danger: 'bg-red-500/15 text-red-700',
    warn: 'bg-amber-500/15 text-amber-700',
    info: 'bg-blue-500/15 text-blue-700',
  }[tone]
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider', styles)}>
      {children}
    </span>
  )
}

function DocDetail({ doc }: { doc: DocRow | null }) {
  if (!doc) {
    return (
      <div className="p-6 text-sm text-[hsl(var(--muted-foreground))]">
        Select a document on the left to inspect.
      </div>
    )
  }
  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {doc.title}
          {doc.is_deprecated && <Badge tone="danger">deprecated</Badge>}
        </h3>
        <p className="font-mono text-xs text-indigo-700">{doc.id}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Type" value={doc.doc_type} />
        <Field label="Category" value={doc.category} />
        <Field label="Version" value={String(doc.version)} />
        <Field label="Effective" value={doc.effective_date} />
        <Field label="Supersedes" value={doc.supersedes ?? '—'} />
        <Field label="Min persona" value={doc.min_persona} />
        <Field label="Regions" value={doc.regions.join(', ')} />
        <Field label="Owner" value={doc.owner ?? '—'} />
        <Field label="Last reviewed" value={doc.last_reviewed ?? '—'} />
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-indigo-700/80 mb-1">
          Raw markdown
        </div>
        <pre className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed">
          {doc.raw_markdown}
        </pre>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className="font-mono">{value}</div>
    </div>
  )
}

function AuditList({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-sm text-[hsl(var(--muted-foreground))]">
        No audit rows yet — ask a question on the Copilot tab.
      </div>
    )
  }
  return (
    <ul className="divide-y divide-[hsl(var(--border))]">
      {rows.map((r) => (
        <AuditItem key={r.id} row={r} />
      ))}
    </ul>
  )
}

function AuditItem({ row }: { row: AuditRow }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none px-4 py-3 hover:bg-indigo-600/5 flex items-center gap-3">
        <span className="transition-transform group-open:rotate-90 text-indigo-700/60">▸</span>
        <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] w-32 shrink-0">
          {new Date(row.ts).toLocaleTimeString()}
        </span>
        <Badge tone={row.persona === 'executive' ? 'info' : row.persona === 'hr_admin' ? 'warn' : 'muted'}>
          {row.persona}
        </Badge>
        <span className="text-sm flex-1 truncate">{row.query}</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
          {row.retrieved_chunk_ids.length}↑ {row.filtered_out_chunk_ids.length}↓
          {row.pii_redactions > 0 && ` · pii ${row.pii_redactions}`}
          {row.faithfulness_score != null && ` · f ${Number(row.faithfulness_score).toFixed(2)}`}
          {' · '}
          {row.latency_ms}ms
        </span>
      </summary>
      <div className="px-12 py-3 text-xs space-y-3 bg-indigo-600/5 border-t border-[hsl(var(--border))]">
        {row.answer && (
          <section>
            <div className="font-semibold text-indigo-700/80 mb-1">Answer</div>
            <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 whitespace-pre-wrap">
              {row.answer}
            </div>
          </section>
        )}
        <section>
          <div className="font-semibold text-indigo-700/80 mb-1">
            Citations
          </div>
          <div className="font-mono">
            {row.citations.length === 0 ? (
              <span className="text-[hsl(var(--muted-foreground))]">none</span>
            ) : (
              row.citations.map((c) => (
                <span key={c} className="mr-2 text-indigo-700">
                  [{c}]
                </span>
              ))
            )}
          </div>
        </section>
        <section>
          <div className="font-semibold text-indigo-700/80 mb-1">
            Filtered out ({row.filtered_out_chunk_ids.length})
          </div>
          <ul className="font-mono space-y-0.5">
            {row.filtered_out_chunk_ids.map((id) => (
              <li key={id} className="flex gap-2">
                <span className="text-[hsl(var(--muted-foreground))]">{id.slice(0, 8)}</span>
                <Badge tone={
                  row.filter_reasons[id] === 'min_persona' ? 'danger' :
                  row.filter_reasons[id] === 'deprecated' ? 'warn' : 'info'
                }>
                  {row.filter_reasons[id] ?? 'unknown'}
                </Badge>
              </li>
            ))}
            {row.filtered_out_chunk_ids.length === 0 && (
              <li className="text-[hsl(var(--muted-foreground))]">none</li>
            )}
          </ul>
        </section>
      </div>
    </details>
  )
}
