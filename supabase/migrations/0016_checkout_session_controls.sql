-- Additive, opt-in. Apply and validate in staging before enabling either flag.
BEGIN;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS idempotency_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_cliente_idempotency_unique ON public.pedidos (cliente_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.sessoes_revogadas (jti text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS sessoes_revogadas_expiry ON public.sessoes_revogadas (expires_at);
ALTER TABLE public.sessoes_revogadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sessoes_revogadas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessoes_revogadas TO service_role;
COMMIT;
