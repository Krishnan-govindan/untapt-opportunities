-- Expand status enum to include intermediate pipeline steps
ALTER TABLE public.prototypes
  DROP CONSTRAINT IF EXISTS prototypes_status_check;

ALTER TABLE public.prototypes
  ADD CONSTRAINT prototypes_status_check
    CHECK (status IN (
      'researching','strategizing','branding','designing','deploying','deployed','failed'
    ));

-- Store generated business strategy alongside the prototype
ALTER TABLE public.prototypes
  ADD COLUMN IF NOT EXISTS business_context jsonb;
