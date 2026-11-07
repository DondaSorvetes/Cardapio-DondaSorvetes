-- 0021 — Destaque do topo do cardápio
--
-- * tags.destaque_cardapio: a tag marcada vira o carrossel do topo do cardápio
--   (ex.: "Mais vendidos", "Promoção"). Só uma tag pode estar marcada por vez,
--   garantido pelo índice único parcial abaixo. Nenhuma marcada = sem carrossel.
-- * tags.icone: ícone da tag (chave de TAG_ICONES em src/components/ui/TagIcone.tsx,
--   ex.: 'promocao', 'mais_vendido'). Vazio = escolhido automaticamente pelo nome.
--
-- Rollback: supabase/rollbacks/0021_tags_destaque_cardapio.sql

BEGIN;

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS destaque_cardapio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS icone text;

CREATE UNIQUE INDEX IF NOT EXISTS tags_um_destaque_cardapio
  ON public.tags ((true))
  WHERE destaque_cardapio;

COMMENT ON COLUMN public.tags.destaque_cardapio IS
  'Tag exibida como carrossel no topo do cardápio (no máximo uma).';
COMMENT ON COLUMN public.tags.icone IS
  'Chave do ícone da tag; NULL = automático pelo nome.';

COMMIT;
