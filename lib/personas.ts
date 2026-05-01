import { cookies } from 'next/headers'

export type Persona = 'employee' | 'hr_admin' | 'executive'
export type Region = 'WI' | 'NY' | 'ALL'

export const PERSONA_COOKIE = 'mhr_persona'
export const REGION_COOKIE = 'mhr_region'

const VALID_PERSONAS: readonly Persona[] = ['employee', 'hr_admin', 'executive'] as const
const VALID_REGIONS: readonly Region[] = ['WI', 'NY', 'ALL'] as const

const COOKIE_OPTS = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
}

export function getPersona(): Persona {
  const v = cookies().get(PERSONA_COOKIE)?.value
  return VALID_PERSONAS.includes(v as Persona) ? (v as Persona) : 'employee'
}

// Server-action / route-handler only — Next.js disallows mutating cookies
// from a plain server component.
export function setPersona(p: Persona): void {
  if (!VALID_PERSONAS.includes(p)) throw new Error(`Invalid persona: ${p}`)
  cookies().set(PERSONA_COOKIE, p, COOKIE_OPTS)
}

export function getRegion(): Region {
  const v = cookies().get(REGION_COOKIE)?.value
  return VALID_REGIONS.includes(v as Region) ? (v as Region) : 'ALL'
}

export function setRegion(r: Region): void {
  if (!VALID_REGIONS.includes(r)) throw new Error(`Invalid region: ${r}`)
  cookies().set(REGION_COOKIE, r, COOKIE_OPTS)
}
