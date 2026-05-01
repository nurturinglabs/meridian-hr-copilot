import Link from 'next/link'

export const metadata = {
  title: 'Request flow · Meridian HR Copilot',
}

const STEPS = [
  {
    title: 'Request arrives',
    body: 'The browser POSTs the user’s question to /api/chat. Persona and region are read from cookies set by the inline selectors on /copilot — no body, no headers required from the client beyond the question itself. The route handler hands off to retrieveAndAnswer with the persona, region, and query.',
  },
  {
    title: 'Query embedding',
    body: 'A single call to OpenAI’s text-embedding-3-small turns the question into a 1536-dimensional vector. The same model and dimensionality embedded every chunk at ingestion time, so the query vector lives in the same semantic space as the corpus. ~50ms, batched up to 100 inputs per call when used elsewhere.',
  },
  {
    title: 'RBAC vector search',
    body: 'Three Postgres RPCs fire in parallel. The restricted call uses set_config(\'app.mhr_persona\', persona, true) so the RLS policy on mhr_chunks fires and only allowed chunks come back. The unrestricted call uses SECURITY DEFINER to bypass RLS and return what the highest tier would have seen. The deprecated call returns top-K chunks where is_deprecated=true.',
    note: 'Persona enforcement happens in SQL, not in app code. The same query that does vector similarity also enforces governance — an attacker who somehow forged the persona would still be bounded by what the policy allows.',
  },
  {
    title: 'Governance diff',
    body: 'Subtracting the restricted set from the unrestricted set yields the chunks RBAC blocked. Adding the deprecated set yields chunks that would have matched but were retired. For each filtered chunk we classify the reason — min_persona, region, or deprecated — by comparing its metadata against the caller’s persona and region.',
    note: 'Every retrieval is replayable for compliance. The Trace panel on /copilot and the Audit Log on /governance both render directly from this diff — there is no separate “explain why I was denied” step.',
  },
  {
    title: 'PII redaction',
    body: 'A regex pass scrubs SSN, DOB, account numbers, and credit-card-shaped digits out of each chunk’s content before it reaches the LLM. The redaction count is tracked per request and surfaced in the audit row. Doing this at retrieval time (not ingestion) means redaction policy can vary per persona without rebuilding the embedding index.',
  },
  {
    title: 'Answer generation',
    body: 'Claude Sonnet receives only the redacted chunks plus a strict prompt: cite every claim with [doc-id], refuse if the chunks don’t contain the answer, no outside knowledge. Citations come back inline and are extracted by regex to populate the citation pills on the chat UI.',
  },
  {
    title: 'Faithfulness scoring',
    body: 'A second Claude pass scores 0–1 how strictly the answer is supported by the retrieved chunks. JSON-only output is parsed leniently — non-numeric or malformed responses default to 0 and are logged rather than thrown. The score lands on every audit row alongside the answer.',
    note: 'Cheap insurance against hallucination — and a real number that shows up on /evals across the whole golden-question set, not just one production query.',
  },
  {
    title: 'Audit + response',
    body: 'A row lands in mhr_audit_log with retrieved chunk IDs, filtered-out IDs, the JSON map of filter reasons, citations, faithfulness score, PII redaction count, and total latency. The audit write uses the service-role client so it always succeeds regardless of caller persona. The same payload returns to the client as the API response.',
  },
]

export default function FlowPage() {
  return (
    <article className="max-w-4xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Request flow</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          What happens when one HR question arrives at /api/chat.
        </p>
      </header>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 p-6">
        <img
          src="/diagrams/request-flow.svg"
          alt="Request flow through retrieveAndAnswer"
          className="w-full h-auto"
        />
      </div>

      <section className="space-y-6">
        {STEPS.map((s, i) => (
          <Step key={i} num={i + 1} title={s.title} body={s.body} note={s.note} />
        ))}
      </section>

      <Link
        href="/governance"
        className="block rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors p-5"
      >
        <h3 className="text-base font-semibold mb-1">See it live</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Open the audit log to watch one of these requests happen end-to-end in real time.
        </p>
        <span className="text-xs text-emerald-400 font-mono mt-2 inline-block">
          /governance →
        </span>
      </Link>
    </article>
  )
}

function Step({
  num,
  title,
  body,
  note,
}: {
  num: number
  title: string
  body: string
  note?: string
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1 flex items-baseline gap-2">
        <span className="font-mono text-xs text-emerald-400">{String(num).padStart(2, '0')}</span>
        <span>{title}</span>
      </h3>
      <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{body}</p>
      {note && (
        <div className="mt-2 border-l-2 border-emerald-500 pl-3 py-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          <span className="text-emerald-400 font-semibold mr-1">Why this matters:</span>
          {note}
        </div>
      )}
    </div>
  )
}
