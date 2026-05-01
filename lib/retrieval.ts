import Anthropic from '@anthropic-ai/sdk'
import { createAnonClient } from './supabase'
import { embed } from './embeddings'
import { redactPII } from './pii'
import { writeAudit } from './audit'
import { scoreFaithfulness } from './faithfulness'
import { answerPrompt } from './prompts'
import type { Persona, Region } from './personas'

const ANSWER_MODEL = 'claude-sonnet-4-5'
const PERSONA_RANK: Record<Persona, number> = { employee: 1, hr_admin: 2, executive: 3 }

let anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY must be set')
    anthropic = new Anthropic({ apiKey })
  }
  return anthropic
}

type RpcChunk = {
  id: string
  document_id: string
  content: string
  min_persona: Persona
  regions: string[]
  is_deprecated: boolean
  doc_type: string
  similarity: number
}

export type RetrievedChunk = RpcChunk
export type FilteredChunk = RpcChunk & { reason: 'min_persona' | 'region' | 'deprecated' }

export type RetrieveArgs = {
  query: string
  persona: Persona
  region?: Region
  topK?: number
}

export type RetrieveResult = {
  answer: string
  citations: string[]
  chunks: RetrievedChunk[]
  filteredOut: FilteredChunk[]
  faithfulness: number
  latencyMs: number
  piiRedactions: number
}

function toVectorLiteral(vec: number[]): string {
  return '[' + vec.join(',') + ']'
}

function classifyFilterReason(
  chunk: RpcChunk,
  persona: Persona,
  region: Region,
): 'min_persona' | 'region' {
  if (PERSONA_RANK[chunk.min_persona] > PERSONA_RANK[persona]) return 'min_persona'
  if (region !== 'ALL' && !chunk.regions.includes('ALL') && !chunk.regions.includes(region)) {
    return 'region'
  }
  // Fallback — shouldn't happen given the unrestricted RPC's filters mirror the restricted one
  // minus the persona check, but pick the safer default for the audit reason field.
  return 'min_persona'
}

function extractCitations(answer: string, retrievedDocIds: Set<string>): string[] {
  const ids = new Set<string>()
  for (const m of answer.matchAll(/\[([a-z0-9][a-z0-9-]*[a-z0-9])\]/g)) {
    const id = m[1]
    if (retrievedDocIds.has(id)) ids.add(id)
  }
  return [...ids]
}

async function generateAnswer(args: {
  query: string
  chunks: RetrievedChunk[]
  persona: Persona
}): Promise<string> {
  if (args.chunks.length === 0) {
    return "I don't have that information in our current HR content — please contact HR directly."
  }
  const chunksText = args.chunks
    .map((c) => `[${c.document_id}]\n${c.content}`)
    .join('\n\n---\n\n')
  const prompt = answerPrompt({
    persona: args.persona,
    query: args.query,
    chunks: chunksText,
  })
  const res = await getAnthropic().messages.create({
    model: ANSWER_MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

export async function retrieveAndAnswer(args: RetrieveArgs): Promise<RetrieveResult> {
  const { query, persona, region = 'ALL', topK = 5 } = args
  const t0 = Date.now()

  const [queryVec] = await embed([query])
  const queryLiteral = toVectorLiteral(queryVec)
  const sb = createAnonClient()

  const [restrictedRes, unrestrictedRes, deprecatedRes] = await Promise.all([
    sb.rpc('mhr_search_chunks', {
      query_embedding: queryLiteral,
      p_persona: persona,
      p_region: region,
      p_top_k: topK,
    }),
    sb.rpc('mhr_search_chunks_unrestricted', {
      query_embedding: queryLiteral,
      p_region: region,
      p_top_k: topK,
    }),
    sb.rpc('mhr_search_chunks_deprecated', {
      query_embedding: queryLiteral,
      p_top_k: topK,
    }),
  ])
  if (restrictedRes.error) throw new Error(`restricted search: ${restrictedRes.error.message}`)
  if (unrestrictedRes.error) throw new Error(`unrestricted search: ${unrestrictedRes.error.message}`)
  if (deprecatedRes.error) throw new Error(`deprecated search: ${deprecatedRes.error.message}`)

  const allowed = (restrictedRes.data ?? []) as RpcChunk[]
  const unrestricted = (unrestrictedRes.data ?? []) as RpcChunk[]
  const deprecated = (deprecatedRes.data ?? []) as RpcChunk[]

  const allowedIds = new Set(allowed.map((c) => c.id))
  const filteredOut: FilteredChunk[] = []
  const seenFiltered = new Set<string>()

  for (const c of unrestricted) {
    if (allowedIds.has(c.id) || seenFiltered.has(c.id)) continue
    filteredOut.push({ ...c, reason: classifyFilterReason(c, persona, region) })
    seenFiltered.add(c.id)
  }
  for (const c of deprecated) {
    if (allowedIds.has(c.id) || seenFiltered.has(c.id)) continue
    filteredOut.push({ ...c, reason: 'deprecated' })
    seenFiltered.add(c.id)
  }

  let piiRedactions = 0
  const redactedChunks: RetrievedChunk[] = allowed.map((c) => {
    const { redacted, count } = redactPII(c.content)
    piiRedactions += count
    return { ...c, content: redacted }
  })

  const answer = await generateAnswer({ query, chunks: redactedChunks, persona })
  const citations = extractCitations(answer, new Set(redactedChunks.map((c) => c.document_id)))
  const faithfulness = await scoreFaithfulness({ query, answer, chunks: redactedChunks })

  const latencyMs = Date.now() - t0

  await writeAudit({
    persona,
    query,
    retrievedChunkIds: allowed.map((c) => c.id),
    filteredOutChunkIds: filteredOut.map((c) => c.id),
    filterReasons: Object.fromEntries(filteredOut.map((c) => [c.id, c.reason])),
    piiRedactions,
    answer,
    citations,
    faithfulnessScore: faithfulness,
    latencyMs,
  })

  return {
    answer,
    citations,
    chunks: redactedChunks,
    filteredOut,
    faithfulness,
    latencyMs,
    piiRedactions,
  }
}
