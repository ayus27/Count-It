CREATE TABLE public.workspace_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  join_code text NOT NULL
);
GRANT ALL ON public.workspace_settings TO service_role;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.workspace_settings (id, join_code) VALUES (1, 'FOOTSET2026');

CREATE TABLE public.workspace_members (
  user_id uuid PRIMARY KEY,
  full_name text NOT NULL,
  public_key jsonb NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _uid)
$$;

CREATE POLICY "members see members" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "update own member row" ON public.workspace_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.join_workspace(_code text, _full_name text, _public_key jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_settings WHERE upper(join_code) = upper(trim(_code))) THEN
    RETURN false;
  END IF;
  INSERT INTO public.workspace_members (user_id, full_name, public_key)
  VALUES (auth.uid(), left(trim(_full_name), 80), _public_key)
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, public_key = EXCLUDED.public_key;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.join_workspace(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_workspace(text, text, jsonb) TO authenticated;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  recipient_id uuid,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  wrapped_keys jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_created_idx ON public.chat_messages (created_at);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read their messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid()) AND (recipient_id IS NULL OR sender_id = auth.uid() OR recipient_id = auth.uid()));
CREATE POLICY "members send as self" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_workspace_member(auth.uid())
    AND (recipient_id IS NULL OR public.is_workspace_member(recipient_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;