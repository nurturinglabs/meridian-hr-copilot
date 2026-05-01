import { createServiceClient } from './supabase'
import type { Persona } from './personas'

export type AuditEntry = {
  persona: Persona
  query: string
  retrievedChunkIds: string[]
  filteredOutChunkIds: string[]
  filterReasons: Record<string, string>
  piiRedactions: number
  answer: string | null
  citations: string[]
  faithfulnessScore: number | null
  latencyMs: number
}

// Audit writes use the service-role client so they're guaranteed to land
// regardless of the calling persona's RLS scope. A failed audit insert is
// logged but never thrown — the user's response should still return.
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb.from('mhr_audit_log').insert({
    persona: entry.persona,
    query: entry.query,
    retrieved_chunk_ids: entry.retrievedChunkIds,
    filtered_out_chunk_ids: entry.filteredOutChunkIds,
    filter_reasons: entry.filterReasons,
    pii_redactions: entry.piiRedactions,
    answer: entry.answer,
    citations: entry.citations,
    faithfulness_score: entry.faithfulnessScore,
    latency_ms: entry.latencyMs,
  })
  if (error) console.error('audit write failed:', error.message)
}
