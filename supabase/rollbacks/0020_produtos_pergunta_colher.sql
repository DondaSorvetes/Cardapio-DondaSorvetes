-- Rollback de 0020_produtos_pergunta_colher.sql.
-- Remove a configuração por produto. As respostas já gravadas em pedidos.itens
-- (campo "colher") continuam no histórico dos pedidos.
BEGIN;

ALTER TABLE public.produtos DROP COLUMN IF EXISTS pergunta_colher;

COMMIT;
