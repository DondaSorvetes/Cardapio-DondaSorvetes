-- Rollback de 0025_admin_push_subscriptions.sql: apaga as inscrições de
-- notificação (os aparelhos param de receber avisos de pedido novo).
BEGIN;
DROP TABLE IF EXISTS public.admin_push_subscriptions;
COMMIT;
