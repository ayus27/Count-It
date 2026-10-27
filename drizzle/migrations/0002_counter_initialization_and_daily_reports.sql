ALTER TABLE public.counters ADD COLUMN archived boolean NOT NULL DEFAULT false;
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY user_id, role ORDER BY created_at, id) AS ordinal FROM public.counters WHERE role IS NOT NULL) UPDATE public.counters SET archived = true FROM ranked WHERE counters.id = ranked.id AND ranked.ordinal > 1;
CREATE UNIQUE INDEX counters_active_role_unique ON public.counters (user_id, role) WHERE archived = false AND role IS NOT NULL;
ALTER TABLE public.tally_days ADD COLUMN report jsonb;
ALTER TABLE public.tally_days ADD COLUMN report_saved_at timestamptz;
CREATE OR REPLACE FUNCTION public.initialize_counters() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.counters WHERE user_id = auth.uid()) THEN
    INSERT INTO public.counters (user_id, name, description, color, position, role) VALUES
    (auth.uid(), 'Received', 'Customer picked up', 'c1', 0, 'received'),
    (auth.uid(), 'Not received', 'No answer, busy, switched off', 'c2', 1, 'not_received'),
    (auth.uid(), 'Wrong number', 'Wrong person or number not in use', 'c3', 2, 'wrong'),
    (auth.uid(), 'Admitted', 'Confirmed admission', 'c4', 3, 'admitted'),
    (auth.uid(), 'Interested', 'Wants more details', 'c5', 4, 'interested'),
    (auth.uid(), 'Call back', 'Asked to be called later', 'c6', 5, 'callback');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_counters() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_counters() TO authenticated, service_role;