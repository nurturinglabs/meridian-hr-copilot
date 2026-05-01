'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Persona, Region } from '@/lib/personas'

type Chunk = {
  id: string
  document_id: string
  content: string
  similarity: number
  min_persona: Persona
  regions: string[]
  is_deprecated: boolean
  doc_type: string
}

type FilteredChunk = Chunk & { reason: 'min_persona' | 'region' | 'deprecated' }

type Assistant = {
  role: 'assistant'
  answer: string
  citations: string[]
  chunks: Chunk[]
  filteredOut: FilteredChunk[]
  faithfulness: number
  latencyMs: number
  piiRedactions: number
  persona: Persona
  region: Region
}
type User = { role: 'user'; content: string }
type Message = User | Assistant

const EXAMPLES = [
  'How much parental leave do I get?',
  "What's our 401k match?",
  'What are the LTI grant amounts?',
  "What's the investigation process for harassment?",
]

export function ChatClient({ persona, region }: { persona: Persona; region: Region }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [openChunk, setOpenChunk] = useState<{ id: string; content: string; document_id: string } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  async function ask(query: string) {
    if (!query.trim() || pending) return
    setMessages((m) => [...m, { role: 'user', content: query }])
    setInput('')
    setPending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            answer: `Error: ${data.error ?? 'unknown'}`,
            citations: [],
            chunks: [],
            filteredOut: [],
            faithfulness: 0,
            latencyMs: 0,
            piiRedactions: 0,
            persona,
            region,
          },
        ])
      } else {
        setMessages((m) => [...m, { role: 'assistant', ...data }])
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'request failed'
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          answer: `Error: ${msg}`,
          citations: [],
          chunks: [],
          filteredOut: [],
          faithfulness: 0,
          latencyMs: 0,
          piiRedactions: 0,
          persona,
          region,
        },
      ])
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <div className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
        Asking as <span className="text-violet-400 font-medium">{labelPersona(persona)}</span>
        {' · '}region <span className="text-violet-400 font-medium">{region}</span>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2"
      >
        {messages.length === 0 && !pending && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Ask Meridian HR</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
              Try one of these to see persona-aware retrieval, citations, and the trace panel:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="text-sm rounded-full border border-[hsl(var(--border))] px-3 py-1.5 hover:border-violet-500 hover:text-violet-400 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <UserBubble key={i} text={m.content} />
          ) : (
            <AssistantBubble key={i} m={m} onCite={(c) => setOpenChunk(c)} />
          ),
        )}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] fade-in">
            <span className="inline-block size-2 rounded-full bg-violet-600 animate-pulse" />
            retrieving + answering…
          </div>
        )}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask an HR question…"
          disabled={pending}
          className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/60"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white"
        >
          Ask
        </button>
      </form>

      {openChunk && (
        <ChunkDialog
          chunk={openChunk}
          onClose={() => setOpenChunk(null)}
        />
      )}
    </div>
  )
}

function labelPersona(p: Persona): string {
  return p === 'employee' ? 'Employee' : p === 'hr_admin' ? 'HR Admin' : 'Executive'
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end fade-in">
      <div className="max-w-[80%] rounded-2xl bg-violet-500/15 border border-violet-500/30 px-4 py-2 text-sm">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({
  m,
  onCite,
}: {
  m: Assistant
  onCite: (c: { id: string; content: string; document_id: string }) => void
}) {
  return (
    <div className="fade-in space-y-3">
      <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-4 py-3 text-sm leading-relaxed">
        <RenderAnswer text={m.answer} />
      </div>

      {m.citations.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {m.citations.map((id) => {
            const chunk = m.chunks.find((c) => c.document_id === id)
            return (
              <button
                key={id}
                onClick={() =>
                  chunk &&
                  onCite({ id: chunk.id, document_id: id, content: chunk.content })
                }
                className="text-xs font-mono rounded-full border border-violet-500/50 bg-violet-500/10 hover:bg-violet-500/20 px-2 py-1 text-violet-400"
              >
                [{id}]
              </button>
            )
          })}
        </div>
      )}

      <Trace m={m} onCite={onCite} />
    </div>
  )
}

function RenderAnswer({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={line.trim() === '' ? 'h-2' : ''}>
          {renderInline(line)}
        </p>
      ))}
    </>
  )
}

function renderInline(text: string): React.ReactNode[] {
  // Tokenize **bold** and [doc-id] inline; ignore other markdown for the demo.
  const out: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\[[a-z0-9][a-z0-9-]*[a-z0-9]\])/g
  let last = 0
  let key = 0
  for (const m of text.matchAll(pattern)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    const tok = m[0]
    if (tok.startsWith('**')) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>)
    } else {
      out.push(
        <span key={key++} className="font-mono text-violet-400">
          {tok}
        </span>,
      )
    }
    last = idx + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function Trace({
  m,
  onCite,
}: {
  m: Assistant
  onCite: (c: { id: string; content: string; document_id: string }) => void
}) {
  return (
    <details className="group rounded-lg border border-violet-500/30 bg-violet-500/5">
      <summary className="cursor-pointer select-none list-none px-3 py-2 text-xs uppercase tracking-wider text-violet-400/90 flex items-center gap-2">
        <span className="transition-transform group-open:rotate-90">▸</span>
        Trace
        <span className="text-[hsl(var(--muted-foreground))] normal-case tracking-normal">
          {m.chunks.length} retrieved · {m.filteredOut.length} filtered ·
          faithfulness {m.faithfulness.toFixed(2)} · {m.latencyMs}ms · pii {m.piiRedactions}
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1 text-xs space-y-3">
        <section>
          <div className="font-semibold text-violet-400/80 mb-1">Retrieved</div>
          <ul className="space-y-1 font-mono">
            {m.chunks.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <button
                  onClick={() => onCite({ id: c.id, document_id: c.document_id, content: c.content })}
                  className="text-violet-400 hover:underline"
                >
                  [{c.document_id}]
                </button>
                <span className="text-[hsl(var(--muted-foreground))]">
                  sim={c.similarity.toFixed(3)}
                </span>
              </li>
            ))}
            {m.chunks.length === 0 && (
              <li className="text-[hsl(var(--muted-foreground))]">none</li>
            )}
          </ul>
        </section>
        <section>
          <div className="font-semibold text-violet-400/80 mb-1">
            Filtered out by governance
          </div>
          <ul className="space-y-1 font-mono">
            {m.filteredOut.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="text-[hsl(var(--muted-foreground))]">[{c.document_id}]</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] uppercase',
                    c.reason === 'min_persona' && 'bg-red-500/15 text-red-300',
                    c.reason === 'deprecated' && 'bg-amber-500/15 text-amber-300',
                    c.reason === 'region' && 'bg-blue-500/15 text-blue-300',
                  )}
                >
                  {c.reason}
                </span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  sim={c.similarity.toFixed(3)}
                </span>
              </li>
            ))}
            {m.filteredOut.length === 0 && (
              <li className="text-[hsl(var(--muted-foreground))]">none</li>
            )}
          </ul>
        </section>
      </div>
    </details>
  )
}

function ChunkDialog({
  chunk,
  onClose,
}: {
  chunk: { id: string; content: string; document_id: string }
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-sm text-violet-400">[{chunk.document_id}]</h3>
          <button
            onClick={onClose}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            close
          </button>
        </div>
        <pre className="text-xs whitespace-pre-wrap font-mono text-[hsl(var(--foreground))]/90 leading-relaxed">
          {chunk.content}
        </pre>
      </div>
    </div>
  )
}
