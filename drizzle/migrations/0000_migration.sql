CREATE TABLE public.counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'c1',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.counters TO authenticated;
GRANT ALL ON public.counters TO service_role;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own counters" ON public.counters FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tally_days (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  visitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tally_days TO authenticated;
GRANT ALL ON public.tally_days TO service_role;
ALTER TABLE public.tally_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own days" ON public.tally_days FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);