import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('mhr_eval_runs')
    .select(
      'id, question, expected_doc_ids, retrieved_doc_ids, precision_at_k, recall_at_k, faithfulness_score, answer, persona, ran_at',
    )
    .order('ran_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rows: data ?? [] })
}
