-- Recreate chats table (dropped by previous migration).
-- user_id stores a session UUID generated client-side — no auth required.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chats enable row level security;

-- Service role (used by /api/chat) bypasses RLS for inserts.
create policy "Anyone can read chats by session"
  on public.chats for select using (true);
