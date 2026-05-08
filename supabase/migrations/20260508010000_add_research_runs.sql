create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  guest_id text not null,
  owner_email text,
  mode text not null,
  topic text not null,
  result_count integer not null default 0,
  total_scanned integer,
  messages jsonb not null default '[]'::jsonb,
  message text,
  empty boolean not null default false,
  opportunities jsonb not null default '[]'::jsonb,
  constraint research_runs_mode_check check (mode in ('saved', 'research')),
  constraint research_runs_guest_id_check check (length(trim(guest_id)) between 8 and 120),
  constraint research_runs_topic_check check (length(trim(topic)) > 0)
);

alter table public.research_runs enable row level security;

create index if not exists research_runs_created_at_idx
  on public.research_runs (created_at desc);

create index if not exists research_runs_guest_idx
  on public.research_runs (guest_id, created_at desc);

create index if not exists research_runs_owner_email_idx
  on public.research_runs (owner_email, created_at desc)
  where owner_email is not null;
