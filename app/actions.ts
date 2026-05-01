'use server'

import { revalidatePath } from 'next/cache'
import { setPersona, setRegion, type Persona, type Region } from '@/lib/personas'

export async function setPersonaAction(p: Persona): Promise<void> {
  setPersona(p)
  revalidatePath('/', 'layout')
}

export async function setRegionAction(r: Region): Promise<void> {
  setRegion(r)
  revalidatePath('/', 'layout')
}
