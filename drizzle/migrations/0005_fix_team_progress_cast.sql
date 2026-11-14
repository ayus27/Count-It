CREATE OR REPLACE FUNCTION public.get_team_daily_progress(_day date)
RETURNS TABLE (user_id uuid, full_name text, dialed integer, calls_assigned integer, last_seen_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(auth.uid()) THEN
    RAISE EXCEPTION 'Workspace membership required';
  END IF;
  RETURN QUERY
  SELECT wm.user_id, wm.full_name,
    COALESCE((SELECT SUM(GREATEST(COALESCE((td.counts ->> c.id::text)::integer, 0), 0))::integer
      FROM public.counters AS c
      WHERE c.user_id = wm.user_id AND c.archived = false AND c.role IN ('received','not_received')), 0),
    COALESCE(td.calls_assigned, 0), wm.last_seen_at, td.updated_at
  FROM public.workspace_members AS wm
  LEFT JOIN public.tally_days AS td ON td.user_id = wm.user_id AND td.day = _day
  ORDER BY wm.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.get_team_daily_progress(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_daily_progress(date) TO authenticated, service_role;