import Anthropic from '@anthropic-ai/sdk'
import { faithfulnessPrompt } from './prompts'

const MODEL = 'claude-sonnet-4-5'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY must be set')
    client = new Anthropic({ apiKey })
  }
  return client
}

export type FaithfulnessChunk = { document_id: string; content: string }

export async function scoreFaithfulness(args: {
  query: string
  answer: string
  chunks: FaithfulnessChunk[]
}): Promise<number> {
  if (args.chunks.length === 0) return 0

  const chunksText = args.chunks
    .map((c) => `[${c.document_id}]\n${c.content}`)
    .join('\n\n---\n\n')

  const prompt = faithfulnessPrompt({
    query: args.query,
    answer: args.answer,
    chunks: chunksText,
  })

  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // Be lenient: pull the first {...} block out of the response.
  // On parse failure, return 0 and log raw — never throw, so retrieval still completes.
  try {
    const match = text.match(/\{[\s\S]*\}/)
    const json = JSON.parse(match ? match[0] : text)
    const score = Number(json.score)
    if (!Number.isFinite(score)) {
      console.error('faithfulness: non-numeric score, raw:', text)
      return 0
    }
    return Math.max(0, Math.min(1, score))
  } catch {
    console.error('faithfulness: JSON parse failed, raw:', text)
    return 0
  }
}
