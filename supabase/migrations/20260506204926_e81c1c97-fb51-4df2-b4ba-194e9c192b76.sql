
-- opportunities
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  pain_summary text not null,
  sources text[] not null default '{}',
  tam_estimate text not null,
  urgency_score int not null check (urgency_score between 1 and 10),
  icp text not null,
  pain_description text not null,
  competitors jsonb not null default '[]'::jsonb,
  why_now text not null,
  mvp_features text[] not null default '{}',
  is_hot boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.opportunities enable row level security;
create policy "Opportunities are viewable by everyone"
  on public.opportunities for select using (true);

-- chats
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chats enable row level security;
create policy "Users can view own chats" on public.chats for select using (auth.uid() = user_id);
create policy "Users can insert own chats" on public.chats for insert with check (auth.uid() = user_id);
create policy "Users can delete own chats" on public.chats for delete using (auth.uid() = user_id);

-- prototypes
create table public.prototypes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  name text not null,
  thumbnail_url text,
  deployed_url text,
  status text not null default 'researching' check (status in ('researching','designing','deploying','deployed','failed')),
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.prototypes enable row level security;
create policy "Users can view own prototypes" on public.prototypes for select using (auth.uid() = user_id);
create policy "Users can insert own prototypes" on public.prototypes for insert with check (auth.uid() = user_id);
create policy "Users can update own prototypes" on public.prototypes for update using (auth.uid() = user_id);
create policy "Users can delete own prototypes" on public.prototypes for delete using (auth.uid() = user_id);

-- realtime for opportunities
alter publication supabase_realtime add table public.opportunities;
