import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createAnonClient, createServiceClient } from '../lib/supabase'
import { embed } from '../lib/embeddings'

async function main() {
  const [vec] = await embed(['executive compensation bonuses equity'])
  const lit = '[' + vec.join(',') + ']'
  console.log(`vec length: ${vec.length}, literal length: ${lit.length}, head: ${lit.slice(0, 60)}...`)

  const sbSvc = createServiceClient()
  const cnt = await sbSvc.from('mhr_chunks').select('id', { count: 'exact', head: true })
  console.log(`mhr_chunks total rows (service): ${cnt.count}`)

  const exec = await sbSvc.from('mhr_chunks').select('id, document_id').eq('document_id', 'pol-exec-compensation')
  console.log(`pol-exec-compensation chunks (service): ${exec.data?.length}, err=${exec.error?.message}`)

  // Re-run the same query that worked in test 1 — does the RPC still answer?
  const [vec2] = await embed(['How much parental leave do I get?'])
  const lit2 = '[' + vec2.join(',') + ']'
  const sbAnon = createAnonClient()
  const r2 = await sbAnon.rpc('mhr_search_chunks', {
    query_embedding: lit2,
    p_persona: 'employee',
    p_region: 'ALL',
    p_top_k: 5,
  })
  console.log(`\n[control] parental leave restricted (employee): ${r2.data?.length ?? 'err'} rows, error=${r2.error?.message ?? 'none'}`)
  for (const row of r2.data ?? []) console.log(`  - ${row.document_id} sim=${row.similarity?.toFixed?.(3)}`)

  for (const label of ['anon', 'service'] as const) {
    const sb = label === 'anon' ? createAnonClient() : createServiceClient()
    console.log(`\n=== ${label} client ===`)

    const r = await sb.rpc('mhr_search_chunks', {
      query_embedding: lit,
      p_persona: 'employee',
      p_region: 'ALL',
      p_top_k: 5,
    })
    console.log(`restricted (employee): ${r.data?.length ?? 'err'} rows, error=${r.error?.message ?? 'none'}`)

    const u = await sb.rpc('mhr_search_chunks_unrestricted', {
      query_embedding: lit,
      p_region: 'ALL',
      p_top_k: 5,
    })
    console.log(`unrestricted: ${u.data?.length ?? 'err'} rows, error=${u.error?.message ?? 'none'}`)
    if (u.data && u.data.length > 0) {
      for (const row of u.data) console.log(`  - ${row.document_id} sim=${row.similarity?.toFixed?.(3)}`)
    }

    const re = await sb.rpc('mhr_search_chunks', {
      query_embedding: lit,
      p_persona: 'executive',
      p_region: 'ALL',
      p_top_k: 5,
    })
    console.log(`restricted (executive): ${re.data?.length ?? 'err'} rows, error=${re.error?.message ?? 'none'}`)
    if (re.data && re.data.length > 0) {
      for (const row of re.data) console.log(`  - ${row.document_id} sim=${row.similarity?.toFixed?.(3)}`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
