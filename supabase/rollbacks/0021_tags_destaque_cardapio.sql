-- Rollback de 0021_tags_destaque_cardapio.sql.
BEGIN;

DROP INDEX IF EXISTS public.tags_um_destaque_cardapio;
ALTER TABLE public.tags DROP COLUMN IF EXISTS destaque_cardapio;
ALTER TABLE public.tags DROP COLUMN IF EXISTS icone;

COMMIT;
