alter table public.user_ideas
  alter column user_id drop not null,
  add column if not exists owner_email text,
  add column if not exists guest_id text,
  add column if not exists owner_type text not null default 'auth';

alter table public.user_ideas
  drop constraint if exists user_ideas_owner_type_check,
  add constraint user_ideas_owner_type_check check (owner_type in ('auth', 'guest'));

update public.user_ideas
set owner_type = 'auth'
where owner_type is null;

create index if not exists user_ideas_guest_owner_idx
  on public.user_ideas (guest_id, owner_email)
  where owner_type = 'guest';

alter table public.prototypes
  alter column user_id drop not null,
  add column if not exists owner_email text,
  add column if not exists guest_id text,
  add column if not exists owner_type text not null default 'auth';

alter table public.prototypes
  drop constraint if exists prototypes_owner_type_check,
  add constraint prototypes_owner_type_check check (owner_type in ('auth', 'guest'));

update public.prototypes
set owner_type = 'auth',
    owner_email = coalesce(owner_email, email)
where owner_type is null or owner_email is null;

create index if not exists prototypes_guest_owner_idx
  on public.prototypes (guest_id, owner_email)
  where owner_type = 'guest';
