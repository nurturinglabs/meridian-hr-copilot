import OpenAI from 'openai'

const MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 100

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY must be set')
    client = new OpenAI({ apiKey })
  }
  return client
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const res = await getClient().embeddings.create({ model: MODEL, input: batch })
    for (const item of res.data) out.push(item.embedding)
  }
  return out
}
