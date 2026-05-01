import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { createServiceClient } from '../lib/supabase'
import { chunkDocument } from '../lib/chunker'
import { embed } from '../lib/embeddings'

type Persona = 'employee' | 'hr_admin' | 'executive'

type Frontmatter = {
  doc_id: string
  title: string
  doc_type: string
  category: string
  version: number
  effective_date: string | Date
  supersedes?: string | null
  is_deprecated?: boolean
  min_persona?: Persona
  regions?: string[]
  owner?: string | null
  last_reviewed?: string | Date | null
}

const corpusDir = path.join(process.cwd(), 'data', 'corpus')

function toIsoDate(v: string | Date | null | undefined): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

function toVectorLiteral(vec: number[]): string {
  return '[' + vec.join(',') + ']'
}

async function main() {
  const t0 = Date.now()
  const sb = createServiceClient()

  // Idempotent re-run: cascade-delete from mhr_documents wipes mhr_chunks too
  // (chunks FK has on delete cascade). neq() picks a value no row will have.
  console.log('truncating mhr_documents and mhr_chunks…')
  const del = await sb.from('mhr_documents').delete().neq('id', '__never_matches__')
  if (del.error) throw del.error

  const files = fs
    .readdirSync(corpusDir)
    .filter((f) => f.endsWith('.md'))
    .sort()

  let totalChunks = 0

  for (const file of files) {
    const raw = fs.readFileSync(path.join(corpusDir, file), 'utf8')
    const parsed = matter(raw)
    const fm = parsed.data as Frontmatter
    const body = parsed.content

    const docRow = {
      id: fm.doc_id,
      title: fm.title,
      doc_type: fm.doc_type,
      category: fm.category,
      version: fm.version,
      effective_date: toIsoDate(fm.effective_date)!,
      supersedes: fm.supersedes ?? null,
      is_deprecated: fm.is_deprecated ?? false,
      min_persona: (fm.min_persona ?? 'employee') as Persona,
      regions: fm.regions ?? ['ALL'],
      owner: fm.owner ?? null,
      last_reviewed: toIsoDate(fm.last_reviewed),
      raw_markdown: raw,
    }

    const docIns = await sb.from('mhr_documents').insert(docRow)
    if (docIns.error) throw new Error(`insert ${fm.doc_id}: ${docIns.error.message}`)

    const chunks = chunkDocument(body, fm.doc_id)
    const vectors = await embed(chunks.map((c) => c.content))

    const chunkRows = chunks.map((c, i) => ({
      document_id: fm.doc_id,
      chunk_index: c.index,
      content: c.content,
      embedding: toVectorLiteral(vectors[i]),
      min_persona: docRow.min_persona,
      regions: docRow.regions,
      is_deprecated: docRow.is_deprecated,
      doc_type: docRow.doc_type,
    }))

    const chunkIns = await sb.from('mhr_chunks').insert(chunkRows)
    if (chunkIns.error) throw new Error(`insert chunks ${fm.doc_id}: ${chunkIns.error.message}`)

    totalChunks += chunks.length
    console.log(`  ${fm.doc_id}: ${chunks.length} chunks`)
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(
    `\nIngested ${files.length} docs, ${totalChunks} chunks in ${elapsed}s`,
  )

  console.log('\n=== verification ===')
  const docCount = await sb
    .from('mhr_documents')
    .select('*', { count: 'exact', head: true })
  console.log(`mhr_documents count: ${docCount.count}`)

  const chunkCount = await sb
    .from('mhr_chunks')
    .select('*', { count: 'exact', head: true })
  console.log(`mhr_chunks count: ${chunkCount.count}`)

  const docs = await sb
    .from('mhr_documents')
    .select('id, is_deprecated, min_persona')
    .order('id')
  console.log('\ndoc_id | is_deprecated | min_persona')
  console.log('-'.repeat(60))
  for (const d of docs.data ?? []) {
    console.log(`${d.id} | ${d.is_deprecated} | ${d.min_persona}`)
  }

  const byType = await sb.from('mhr_chunks').select('doc_type')
  const counts = new Map<string, number>()
  for (const r of byType.data ?? []) {
    counts.set(r.doc_type, (counts.get(r.doc_type) ?? 0) + 1)
  }
  console.log('\ndoc_type | count')
  console.log('-'.repeat(30))
  for (const [t, n] of [...counts.entries()].sort()) {
    console.log(`${t} | ${n}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
