import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { chunkDocument } from '../lib/chunker'
import { embed } from '../lib/embeddings'
import { redactPII } from '../lib/pii'

const corpusDir = path.join(process.cwd(), 'data', 'corpus')

async function main() {
  console.log('=== Chunker ===')
  const policyRaw = fs.readFileSync(path.join(corpusDir, 'pol-parental-leave-v2.md'), 'utf8')
  const { content: policyBody } = matter(policyRaw)
  const chunks = chunkDocument(policyBody, 'pol-parental-leave-v2')
  console.log(`chunks: ${chunks.length}`)
  console.log('--- first chunk ---')
  console.log(chunks[0].content)
  console.log()

  console.log('=== Embeddings ===')
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY missing — set it in .env.local before re-running')
    process.exit(1)
  }
  const [vec] = await embed([chunks[0].content])
  console.log(`dimension: ${vec.length}`)
  if (vec.length !== 1536) {
    console.error(`expected 1536 dims, got ${vec.length}`)
    process.exit(1)
  }
  console.log()

  console.log('=== PII redaction ===')
  const piiRaw = fs.readFileSync(path.join(corpusDir, 'faq-benefits-with-pii.md'), 'utf8')
  const { content: piiBody } = matter(piiRaw)
  const { redacted, count } = redactPII(piiBody)
  console.log(`redactions: ${count}`)
  console.log('--- redacted output ---')
  console.log(redacted)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
