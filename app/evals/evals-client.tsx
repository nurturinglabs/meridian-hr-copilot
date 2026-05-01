'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type EvalRow = {
  id: string
  question: string
  expected_doc_ids: string[]
  retrieved_doc_ids: string[]
  precision_at_k: number
  recall_at_k: number
  faithfulness_score: number
  answer: string | null
  persona: 'employee' | 'hr_admin' | 'executive'
  ran_at: string
}

type SortKey = 'precision_at_k' | 'recall_at_k' | 'faithfulness_score' | 'ran_at'

export function EvalsClient() {
  const [rows, setRows] = useState<EvalRow[] | null>(null)
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('ran_at')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    fetch('/api/evals')
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
    fetch('/api/content')
      .then((r) => r.json())
      .then((d) =>
        setDocs((d.rows ?? []).map((r: { id: string; title: string }) => ({ id: r.id, title: r.title }))),
      )
  }, [])

  const kpis = useMemo(() => {
    if (!rows || rows.length === 0) return null
    const avg = (k: keyof EvalRow) =>
      rows.reduce((a, r) => a + Number(r[k] ?? 0), 0) / rows.length
    return {
      precision: avg('precision_at_k'),
      recall: avg('recall_at_k'),
      faithfulness: avg('faithfulness_score'),
      total: rows.length,
    }
  }, [rows])

  const sorted = useMemo(() => {
    if (!rows) return []
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortKey] as number | string
      const bv = b[sortKey] as number | string
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return copy
  }, [rows, sortKey, sortAsc])

  const docHealth = useMemo(() => {
    if (!rows || docs.length === 0) return null
    const counts = new Map<string, number>()
    for (const d of docs) counts.set(d.id, 0)
    for (const r of rows) {
      for (const id of r.retrieved_doc_ids) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    const entries = [...counts.entries()].map(([id, n]) => ({ id, count: n }))
    const sortedCounts = [...entries].sort((a, b) => b.count - a.count)
    const topQuartileThreshold =
      sortedCounts.length > 0
        ? sortedCounts[Math.floor(sortedCounts.length / 4)].count
        : 0
    return entries
      .map((e) => ({
        ...e,
        title: docs.find((d) => d.id === e.id)?.title ?? '(unknown)',
        flag:
          e.count === 0
            ? 'stale'
            : e.count >= topQuartileThreshold && topQuartileThreshold > 0
              ? 'over'
              : null,
      }))
      .sort((a, b) => b.count - a.count)
  }, [rows, docs])

  if (rows === null) {
    return <div className="text-sm text-[hsl(var(--muted-foreground))]">loading…</div>
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">No eval runs yet</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Run <code className="font-mono text-indigo-700">scripts/seed-evals.ts</code> to
          populate ~50 golden questions with precision / recall / faithfulness scores.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Precision @5" value={kpis!.precision} />
        <Kpi label="Recall @5" value={kpis!.recall} />
        <Kpi label="Faithfulness" value={kpis!.faithfulness} />
        <Kpi label="Total questions" value={kpis!.total} integer />
      </section>

      {/* Eval table */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 overflow-hidden">
        <header className="px-4 py-3 border-b border-[hsl(var(--border))]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-700/90">
            Eval rows ({rows.length})
          </h3>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[hsl(var(--muted))]/30 text-left">
              <tr>
                <Th>Persona</Th>
                <Th>Question</Th>
                <Th>Expected</Th>
                <Th>Retrieved</Th>
                <SortableTh
                  active={sortKey === 'precision_at_k'}
                  asc={sortAsc}
                  onClick={() => toggleSort('precision_at_k')}
                >
                  Precision
                </SortableTh>
                <SortableTh
                  active={sortKey === 'recall_at_k'}
                  asc={sortAsc}
                  onClick={() => toggleSort('recall_at_k')}
                >
                  Recall
                </SortableTh>
                <SortableTh
                  active={sortKey === 'faithfulness_score'}
                  asc={sortAsc}
                  onClick={() => toggleSort('faithfulness_score')}
                >
                  Faithfulness
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-t border-[hsl(var(--border))] hover:bg-indigo-600/5">
                  <td className="px-3 py-2 font-mono">{r.persona}</td>
                  <td className="px-3 py-2 max-w-md truncate">{r.question}</td>
                  <td className="px-3 py-2 font-mono text-indigo-700/80">
                    {r.expected_doc_ids.join(', ')}
                  </td>
                  <td className="px-3 py-2 font-mono text-[hsl(var(--muted-foreground))]">
                    {r.retrieved_doc_ids.join(', ')}
                  </td>
                  <Score n={Number(r.precision_at_k)} />
                  <Score n={Number(r.recall_at_k)} />
                  <Score n={Number(r.faithfulness_score)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Content health */}
      {docHealth && (
        <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 overflow-hidden">
          <header className="px-4 py-3 border-b border-[hsl(var(--border))]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-700/90">
              Content health
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Retrieval count per doc across {rows.length} eval runs.
              <span className="ml-2 text-red-700">never retrieved = stale</span>,
              <span className="ml-2 text-amber-700">top quartile = candidate for splitting</span>
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(var(--muted))]/30 text-left">
                <tr>
                  <Th>Doc ID</Th>
                  <Th>Title</Th>
                  <Th>Retrievals</Th>
                  <Th>Flag</Th>
                </tr>
              </thead>
              <tbody>
                {docHealth.map((h) => (
                  <tr
                    key={h.id}
                    className={cn(
                      'border-t border-[hsl(var(--border))]',
                      h.flag === 'stale' && 'bg-red-500/5',
                      h.flag === 'over' && 'bg-amber-500/5',
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-indigo-700">{h.id}</td>
                    <td className="px-3 py-2">{h.title}</td>
                    <td className="px-3 py-2 font-mono">{h.count}</td>
                    <td className="px-3 py-2">
                      {h.flag === 'stale' && <span className="text-red-700">stale</span>}
                      {h.flag === 'over' && <span className="text-amber-700">over-retrieved</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc((v) => !v)
    else {
      setSortKey(k)
      setSortAsc(false)
    }
  }
}

function Kpi({ label, value, integer }: { label: string; value: number; integer?: boolean }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className="text-2xl font-semibold text-indigo-700 mt-0.5">
        {integer ? value : value.toFixed(2)}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium">
      {children}
    </th>
  )
}

function SortableTh({
  active,
  asc,
  onClick,
  children,
}: {
  active: boolean
  asc: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium">
      <button
        onClick={onClick}
        className={cn('flex items-center gap-1', active && 'text-indigo-700')}
      >
        {children} {active && <span>{asc ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}

function Score({ n }: { n: number }) {
  const tone =
    n < 0.5 ? 'text-red-700' : n < 0.8 ? 'text-amber-700' : 'text-emerald-700'
  return <td className={cn('px-3 py-2 font-mono', tone)}>{n.toFixed(2)}</td>
}
