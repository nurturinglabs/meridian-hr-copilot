export type Chunk = { content: string; index: number }

const MIN_TOKENS = 100
const MAX_TOKENS = 800

// Rough English token estimate: ~1.3 tokens per whitespace-separated word.
// Good enough for the chunker's size guardrails; not used for billing.
function approxTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.ceil(words * 1.3)
}

type Section = { heading: string; body: string }

function splitH2(markdown: string): Section[] {
  const sections: Section[] = []
  let inFrontmatter = false
  let currentHeading: string | null = null
  let currentBody: string[] = []
  let preamble: string[] = []

  const flush = () => {
    if (currentHeading !== null) {
      sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() })
      currentHeading = null
      currentBody = []
    }
  }

  for (const line of markdown.split('\n')) {
    if (line.trim() === '---') {
      inFrontmatter = !inFrontmatter
      continue
    }
    if (inFrontmatter) continue

    // Skip h1 — treated as the document title and stored in metadata.
    if (/^#\s+/.test(line)) continue

    if (/^##\s+/.test(line)) {
      flush()
      if (preamble.length > 0 && preamble.join('').trim().length > 0) {
        sections.push({ heading: 'Overview', body: preamble.join('\n').trim() })
        preamble = []
      }
      currentHeading = line.replace(/^##\s+/, '').trim()
      currentBody = []
      continue
    }

    if (currentHeading !== null) {
      currentBody.push(line)
    } else {
      preamble.push(line)
    }
  }
  flush()

  return sections.filter((s) => s.body.length > 0)
}

function splitOnParagraphs(body: string, maxTokens: number): string[] {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const out: string[] = []
  let buf: string[] = []
  let bufTokens = 0
  for (const p of paragraphs) {
    const t = approxTokens(p)
    if (buf.length > 0 && bufTokens + t > maxTokens) {
      out.push(buf.join('\n\n'))
      buf = [p]
      bufTokens = t
    } else {
      buf.push(p)
      bufTokens += t
    }
  }
  if (buf.length > 0) out.push(buf.join('\n\n'))
  return out
}

// PRD §6.1: split on h2 (then h3 inside oversized sections), merge sections under
// 100 tokens with the next sibling, split sections over 800 tokens on paragraphs.
// Each chunk is prefixed with its section heading for retrieval context.
export function chunkDocument(markdown: string, _docId: string): Chunk[] {
  const sections = splitH2(markdown)

  const expanded: Section[] = []
  for (const s of sections) {
    if (approxTokens(s.body) > MAX_TOKENS) {
      const parts = splitOnParagraphs(s.body, MAX_TOKENS)
      parts.forEach((body, i) => {
        expanded.push({
          heading: parts.length > 1 ? `${s.heading} (part ${i + 1})` : s.heading,
          body,
        })
      })
    } else {
      expanded.push(s)
    }
  }

  const merged: Section[] = []
  let pending: Section | null = null
  for (const s of expanded) {
    if (pending) {
      const combined: Section = {
        heading: `${pending.heading} & ${s.heading}`,
        body: `${pending.body}\n\n${s.body}`,
      }
      pending = null
      if (approxTokens(combined.body) < MIN_TOKENS) {
        pending = combined
      } else {
        merged.push(combined)
      }
    } else if (approxTokens(s.body) < MIN_TOKENS) {
      pending = { ...s }
    } else {
      merged.push({ ...s })
    }
  }
  if (pending) {
    if (merged.length > 0) {
      const last = merged[merged.length - 1]
      last.heading = `${last.heading} & ${pending.heading}`
      last.body = `${last.body}\n\n${pending.body}`
    } else {
      merged.push(pending)
    }
  }

  return merged.map((s, i) => ({
    content: `## ${s.heading}\n\n${s.body}`,
    index: i,
  }))
}
