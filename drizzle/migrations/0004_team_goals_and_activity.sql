ALTER TABLE public.tally_days
  ADD COLUMN calls_assigned integer NOT NULL DEFAULT 0
  CONSTRAINT tally_days_calls_assigned_range CHECK (calls_assigned >= 0 AND calls_assigned <= 100000);

ALTER TABLE public.workspace_members
  ADD COLUMN last_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.join_workspace(_code text, _full_name text, _public_key jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_settings WHERE upper(join_code) = upper(trim(_code))) THEN
    RETURN false;
  END IF;
  INSERT INTO public.workspace_members (user_id, full_name, public_key, last_seen_at)
  VALUES (auth.uid(), left(trim(_full_name), 80), _public_key, now())
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        public_key = EXCLUDED.public_key,
        last_seen_at = now();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.join_workspace(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_workspace(text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_team_daily_progress(_day date)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  dialed integer,
  calls_assigned integer,
  last_seen_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(auth.uid()) THEN
    RAISE EXCEPTION 'Workspace membership required';
  END IF;

  RETURN QUERY
  SELECT
    wm.user_id,
    wm.full_name,
    COALESCE((
      SELECT SUM(GREATEST((td.counts ->> c.id)::integer, 0))::integer
      FROM public.counters AS c
      WHERE c.user_id = wm.user_id
        AND c.archived = false
        AND c.role IN ('received', 'not_received')
    ), 0) AS dialed,
    COALESCE(td.calls_assigned, 0) AS calls_assigned,
    wm.last_seen_at,
    td.updated_at
  FROM public.workspace_members AS wm
  LEFT JOIN public.tally_days AS td
    ON td.user_id = wm.user_id AND td.day = _day
  ORDER BY wm.full_name;
END $$;
REVOKE ALL ON FUNCTION public.get_team_daily_progress(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_daily_progress(date) TO authenticated, service_role;