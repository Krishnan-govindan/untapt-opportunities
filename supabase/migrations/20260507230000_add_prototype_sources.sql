alter table public.prototypes
  add column if not exists source_type text not null default 'opportunity',
  add column if not exists source_idea_id uuid null references public.user_ideas(id) on delete cascade;

alter table public.prototypes
  alter column opportunity_id drop not null;

alter table public.prototypes
  drop constraint if exists prototypes_source_type_check;

alter table public.prototypes
  add constraint prototypes_source_type_check
  check (source_type in ('opportunity', 'idea'));

alter table public.prototypes
  drop constraint if exists prototypes_source_presence_check;

alter table public.prototypes
  add constraint prototypes_source_presence_check
  check (
    (source_type = 'opportunity' and opportunity_id is not null)
    or
    (source_type = 'idea' and source_idea_id is not null)
  );

create index if not exists prototypes_source_idea_idx
  on public.prototypes(source_idea_id)
  where source_type = 'idea';
