// Order matters: SSN/DOB/account/CC. Account uses the literal "account ending|number"
// prefix so it's run before CC to catch "account ending 4111-1111-1111-1111" cases.
const PATTERNS: { regex: RegExp; replacement: string }[] = [
  { regex: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g, replacement: '[SSN-REDACTED]' },
  { regex: /\b[0-9]{1,2}\/[0-9]{1,2}\/(19|20)[0-9]{2}\b/g, replacement: '[DOB-REDACTED]' },
  { regex: /\baccount (ending|number) [0-9-]+\b/gi, replacement: 'account [REDACTED]' },
  { regex: /\b[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}\b/g, replacement: '[CC-REDACTED]' },
]

export function redactPII(text: string): { redacted: string; count: number } {
  let count = 0
  let out = text
  for (const { regex, replacement } of PATTERNS) {
    out = out.replace(regex, () => {
      count++
      return replacement
    })
  }
  return { redacted: out, count }
}
