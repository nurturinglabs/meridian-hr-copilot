// PRD §6.6: all LLM prompts live in one file for easy review.
// INGESTION_HINT_PROMPT is intentionally omitted — ingestion stays deterministic.

export function answerPrompt(args: {
  persona: string
  query: string
  chunks: string
}): string {
  return `You are an HR copilot for Meridian Mutual employees. Answer the user's question
using ONLY the provided HR content chunks. If the answer isn't in the chunks,
say "I don't have that information in our current HR content — please contact
HR directly." Do not use outside knowledge.

Cite sources by document ID in square brackets, e.g. [pol-parental-leave-v2].
Cite every claim. Keep answers under 150 words.

User persona: ${args.persona}
User question: ${args.query}

Available chunks:
${args.chunks}`
}

export function faithfulnessPrompt(args: {
  query: string
  answer: string
  chunks: string
}): string {
  return `You are evaluating whether an answer is faithful to source content.
Score 0.0 (entirely unsupported) to 1.0 (every claim directly supported).

Question: ${args.query}
Answer: ${args.answer}
Source chunks: ${args.chunks}

Return only JSON: {"score": <float>, "reasoning": "<one sentence>"}`
}
