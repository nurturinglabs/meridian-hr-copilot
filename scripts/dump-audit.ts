import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../lib/supabase'

async function main() {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('mhr_audit_log')
    .select('ts, persona, query, retrieved_chunk_ids, filtered_out_chunk_ids, filter_reasons, pii_redactions, citations, faithfulness_score, latency_ms')
    .order('ts', { ascending: false })
    .limit(3)
  if (error) throw error

  for (const row of (data ?? []).reverse()) {
    console.log('=========================================================')
    console.log(`ts:                ${row.ts}`)
    console.log(`persona:           ${row.persona}`)
    console.log(`query:             ${row.query}`)
    console.log(`retrieved_chunks:  ${row.retrieved_chunk_ids.length}`)
    console.log(`filtered_out:      ${row.filtered_out_chunk_ids.length}`)
    console.log(`filter_reasons:    ${JSON.stringify(row.filter_reasons)}`)
    console.log(`pii_redactions:    ${row.pii_redactions}`)
    console.log(`citations:         ${JSON.stringify(row.citations)}`)
    console.log(`faithfulness:      ${row.faithfulness_score}`)
    console.log(`latency_ms:        ${row.latency_ms}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
