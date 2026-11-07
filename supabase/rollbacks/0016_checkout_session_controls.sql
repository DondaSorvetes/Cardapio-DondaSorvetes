-- First disable CHECKOUT_IDEMPOTENCY_ENABLED and SESSION_REVOCATION_ENABLED.
-- Non-destructive rollback: keep columns, session records and the unique index.
-- Revert the application deployment; no order is removed or rewritten.
-- Expired revoked sessions can be purged later with an audited maintenance job:
-- DELETE FROM public.sessoes_revogadas WHERE expires_at < now();
SELECT 'Disable both feature flags before rolling back the application' AS rollback_requirement;
