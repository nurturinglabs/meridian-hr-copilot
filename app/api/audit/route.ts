import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import type { Persona } from '@/lib/personas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_PERSONAS: Persona[] = ['employee', 'hr_admin', 'executive']

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const personaParam = url.searchParams.get('persona')
  const limitParam = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50

  const sb = createServiceClient()
  let q = sb
    .from('mhr_audit_log')
    .select(
      'id, ts, persona, query, retrieved_chunk_ids, filtered_out_chunk_ids, filter_reasons, pii_redactions, answer, citations, faithfulness_score, latency_ms',
    )
    .order('ts', { ascending: false })
    .limit(limit)

  if (personaParam && VALID_PERSONAS.includes(personaParam as Persona)) {
    q = q.eq('persona', personaParam)
  }

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rows: data ?? [] })
}
