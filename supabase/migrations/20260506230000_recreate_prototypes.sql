-- Recreate prototypes table (dropped by previous migration).
-- user_id is a soft reference — the build API uses service role and
-- generates a UUID for anonymous builds, so no FK constraint.

create table if not exists public.prototypes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  name text not null,
  thumbnail_url text,
  deployed_url text,
  status text not null default 'researching'
    check (status in ('researching','designing','deploying','deployed','failed')),
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.prototypes enable row level security;

-- Service role (used by the build API) bypasses RLS — no insert policy needed.
create policy "Users can view own prototypes"
  on public.prototypes for select using (auth.uid() = user_id);
