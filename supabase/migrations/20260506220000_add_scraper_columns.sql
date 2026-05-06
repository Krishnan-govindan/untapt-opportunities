-- Add columns needed by the scraper pipeline.
-- sources_detail stores structured [{platform, snippet, url}] from Claude.
-- dedup_hash prevents re-inserting the same opportunity across cycles.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS sources_detail jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dedup_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_dedup_hash_idx
  ON public.opportunities (dedup_hash)
  WHERE dedup_hash IS NOT NULL;
