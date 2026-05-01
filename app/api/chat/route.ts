import { NextRequest, NextResponse } from 'next/server'
import { getPersona, getRegion } from '@/lib/personas'
import { retrieveAndAnswer } from '@/lib/retrieval'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    if (!query) {
      return NextResponse.json({ error: 'query required' }, { status: 400 })
    }

    const persona = getPersona()
    const region = getRegion()

    const result = await retrieveAndAnswer({ query, persona, region })

    return NextResponse.json({
      persona,
      region,
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'server error'
    console.error('/api/chat error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
