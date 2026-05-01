import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('mhr_documents')
    .select(
      'id, title, doc_type, category, version, effective_date, supersedes, is_deprecated, min_persona, regions, owner, last_reviewed, raw_markdown, created_at',
    )
    .order('category', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rows: data ?? [] })
}
