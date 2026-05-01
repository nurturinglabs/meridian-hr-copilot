-- Vector search RPCs for the retrieval pipeline.
--
-- Three functions, called in parallel from lib/retrieval.ts:
--
--   1. mhr_search_chunks            — SECURITY INVOKER. Sets the per-tx GUC
--                                     app.mhr_persona so the RLS policy on
--                                     mhr_chunks fires. Returns the chunks the
--                                     calling persona is actually allowed to see.
--
--   2. mhr_search_chunks_unrestricted — SECURITY DEFINER. Bypasses RLS to return
--                                     the top-K non-deprecated chunks ignoring
--                                     persona/region. Diff against (1) to see
--                                     what governance filtered out, and why.
--
--   3. mhr_search_chunks_deprecated — SECURITY DEFINER. Returns top-K *deprecated*
--                                     chunks similar to the query so the trace
--                                     can flag "would have matched but is_deprecated".
--
-- All three use cosine distance (<=>) and return 1 - distance as similarity.

create or replace function mhr_search_chunks(
  query_embedding vector(1536),
  p_persona mhr_persona,
  p_region text default 'ALL',
  p_top_k int default 5
) returns table (
  id uuid,
  document_id text,
  content text,
  min_persona mhr_persona,
  regions text[],
  is_deprecated boolean,
  doc_type text,
  similarity float
)
language plpgsql
security invoker
as $$
begin
  perform set_config('app.mhr_persona', p_persona::text, true);
  -- IVFFlat index has lists=50 against only ~37 rows, so most clusters are empty.
  -- Scan all clusters so the search is effectively exact for this demo's corpus size.
  perform set_config('ivfflat.probes', '50', true);
  return query
    select c.id, c.document_id, c.content,
           c.min_persona, c.regions, c.is_deprecated, c.doc_type,
           1 - (c.embedding <=> query_embedding) as similarity
    from mhr_chunks c
    where (p_region = 'ALL' or 'ALL' = any(c.regions) or p_region = any(c.regions))
    order by c.embedding <=> query_embedding
    limit p_top_k;
end;
$$;

create or replace function mhr_search_chunks_unrestricted(
  query_embedding vector(1536),
  p_region text default 'ALL',
  p_top_k int default 5
) returns table (
  id uuid,
  document_id text,
  content text,
  min_persona mhr_persona,
  regions text[],
  is_deprecated boolean,
  doc_type text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  perform set_config('ivfflat.probes', '50', true);
  return query
    select c.id, c.document_id, c.content,
           c.min_persona, c.regions, c.is_deprecated, c.doc_type,
           1 - (c.embedding <=> query_embedding) as similarity
    from mhr_chunks c
    where c.is_deprecated = false
      and (p_region = 'ALL' or 'ALL' = any(c.regions) or p_region = any(c.regions))
    order by c.embedding <=> query_embedding
    limit p_top_k;
end;
$$;

create or replace function mhr_search_chunks_deprecated(
  query_embedding vector(1536),
  p_top_k int default 5
) returns table (
  id uuid,
  document_id text,
  content text,
  min_persona mhr_persona,
  regions text[],
  is_deprecated boolean,
  doc_type text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  perform set_config('ivfflat.probes', '50', true);
  return query
    select c.id, c.document_id, c.content,
           c.min_persona, c.regions, c.is_deprecated, c.doc_type,
           1 - (c.embedding <=> query_embedding) as similarity
    from mhr_chunks c
    where c.is_deprecated = true
    order by c.embedding <=> query_embedding
    limit p_top_k;
end;
$$;

grant execute on function mhr_search_chunks(vector, mhr_persona, text, int) to anon, authenticated;
grant execute on function mhr_search_chunks_unrestricted(vector, text, int) to anon, authenticated;
grant execute on function mhr_search_chunks_deprecated(vector, int) to anon, authenticated;
