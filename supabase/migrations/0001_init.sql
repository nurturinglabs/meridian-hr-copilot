-- Extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Personas (the access tiers)
-- 'employee' < 'hr_admin' < 'executive'
-- We model this as an enum + a numeric rank for easy comparison.
create type mhr_persona as enum ('employee', 'hr_admin', 'executive');

create table mhr_documents (
  id text primary key,                           -- e.g. 'pol-parental-leave-v2'
  title text not null,
  doc_type text not null,                        -- policy | sop | faq | guide
  category text not null,                        -- leave_benefits | compensation | etc
  version numeric not null,
  effective_date date not null,
  supersedes text references mhr_documents(id),  -- previous version, nullable
  is_deprecated boolean not null default false,
  min_persona mhr_persona not null default 'employee',
  regions text[] not null default array['ALL'],
  owner text,
  last_reviewed date,
  raw_markdown text not null,
  created_at timestamptz not null default now()
);

create table mhr_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references mhr_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  -- denormalized from mhr_documents for fast filtering in vector search
  min_persona mhr_persona not null,
  regions text[] not null,
  is_deprecated boolean not null,
  doc_type text not null,
  created_at timestamptz not null default now()
);

create index mhr_chunks_embedding_idx on mhr_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 50);
create index mhr_chunks_filter_idx on mhr_chunks (min_persona, is_deprecated);

create table mhr_audit_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  persona mhr_persona not null,
  query text not null,
  retrieved_chunk_ids uuid[] not null,
  filtered_out_chunk_ids uuid[] not null,        -- chunks RLS would have blocked
  filter_reasons jsonb not null,                 -- {"chunk_id": "min_persona", ...}
  pii_redactions int not null default 0,
  answer text,
  citations text[] not null default array[]::text[],
  faithfulness_score numeric,
  latency_ms int not null
);

create table mhr_eval_runs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  expected_doc_ids text[] not null,              -- ground truth
  retrieved_doc_ids text[] not null,
  precision_at_k numeric not null,
  recall_at_k numeric not null,
  faithfulness_score numeric not null,
  answer text,
  persona mhr_persona not null default 'employee',
  ran_at timestamptz not null default now()
);

-- Persona rank function for RLS comparison
create or replace function mhr_persona_rank(p mhr_persona) returns int
  language sql immutable as $$
    select case p
      when 'employee' then 1
      when 'hr_admin' then 2
      when 'executive' then 3
    end
  $$;

-- RLS: enforce min_persona at the data layer
alter table mhr_chunks enable row level security;
alter table mhr_documents enable row level security;

-- Read policy on mhr_chunks: current_setting('app.mhr_persona') is set per-request
create policy mhr_chunks_persona_read on mhr_chunks for select using (
  mhr_persona_rank(min_persona) <= mhr_persona_rank(
    coalesce(current_setting('app.mhr_persona', true), 'employee')::mhr_persona
  )
  and is_deprecated = false
);

create policy mhr_documents_persona_read on mhr_documents for select using (
  mhr_persona_rank(min_persona) <= mhr_persona_rank(
    coalesce(current_setting('app.mhr_persona', true), 'employee')::mhr_persona
  )
);

-- mhr_audit_log and mhr_eval_runs: service-role only writes/reads (no RLS needed for demo)
