ALTER TABLE public.chat_messages
  ADD COLUMN body text;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_body_length
  CHECK (body IS NULL OR (char_length(body) >= 1 AND char_length(body) <= 4000));

COMMENT ON COLUMN public.chat_messages.body IS 'Workspace-protected message body used for cross-device chat history.';
COMMENT ON COLUMN public.chat_messages.ciphertext IS 'DEPRECATED: legacy device-encrypted message content; retained for existing messages.';
COMMENT ON COLUMN public.chat_messages.iv IS 'DEPRECATED: legacy device-encryption initialization vector; retained for existing messages.';
COMMENT ON COLUMN public.chat_messages.wrapped_keys IS 'DEPRECATED: legacy group-message key envelopes; retained for existing messages.';