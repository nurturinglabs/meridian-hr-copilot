export const metadata = {
  title: 'Architecture · Meridian HR Copilot',
}

export default function ArchitecturePage() {
  return (
    <article className="max-w-4xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Architecture</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Five layers, one Postgres, RBAC enforced at the data layer.
        </p>
      </header>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 p-6">
        <img
          src="/diagrams/architecture.svg"
          alt="Meridian HR Copilot architecture"
          className="w-full h-auto"
        />
      </div>

      <section className="space-y-6">
        <Layer
          title="Corpus"
          body="Fifteen markdown documents with YAML frontmatter encoding persona, region, version, and deprecation. Frontmatter is the metadata layer — every governance decision in the rest of the stack flows from these tags. Authoring stays human-readable; routing stays machine-readable."
        />
        <Layer
          title="Ingestion pipeline"
          body="A semantic chunker splits each document on h2/h3 headings, with size guardrails to merge tiny sections and split oversized ones. OpenAI text-embedding-3-small turns each chunk into a 1536-dim vector. Persona, region, and is_deprecated are denormalized onto every chunk row so the same SQL query that finds nearest neighbors also enforces governance."
        />
        <Layer
          title="Data + governance"
          body="A single Postgres database holds vectors, document metadata, an audit log, and stored eval runs. Row-Level Security policies read app.mhr_persona from a per-request GUC and exclude both above-tier and deprecated chunks at the data layer — not in app code. Three vector-search RPCs (restricted, unrestricted, deprecated) make the diff between “what was returned” and “what was filtered” a structured query, not a guess."
        />
        <Layer
          title="Retrieval API + UI"
          body="The /api/chat route runs the full RAG pipeline: embed → search → diff → redact PII → generate → score faithfulness → audit. The other API routes are read-only views over the same tables. The UI is five pages — Copilot, Governance, Evals, Architecture, Flow — all reading from the same data layer through the same boundary."
        />
      </section>

      <section className="space-y-4 pt-4 border-t border-[hsl(var(--border))]">
        <h2 className="text-xl font-semibold tracking-tight">Why this stack</h2>

        <Reason
          title="Postgres + pgvector instead of a dedicated vector DB"
          body="Vectors, governance metadata, audit log, and eval runs live in one transactional database. RLS enforces persona tiers without a separate access-control service. Adding Pinecone would buy nothing at this corpus size and would scatter the governance story across two systems."
        />
        <Reason
          title="Claude Sonnet for generation"
          body="The answer prompt insists the model use only the supplied chunks and refuse otherwise. Sonnet follows that instruction reliably — including the refusal path on out-of-scope queries — which is the part that makes the demo land."
        />
        <Reason
          title="OpenAI text-embedding-3-small for embeddings"
          body="At 1536 dimensions the embeddings are cheap, fast, and well-supported by pgvector’s ivfflat index. With ~37 chunks the choice is academic; the same code scales to tens of thousands of chunks before you’d revisit it."
        />
      </section>
    </article>
  )
}

function Layer({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        {body}
      </p>
    </div>
  )
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-1 text-emerald-400">{title}</h3>
      <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        {body}
      </p>
    </div>
  )
}
