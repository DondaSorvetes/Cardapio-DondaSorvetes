-- 0020 — Colher por produto
--
-- * produtos.pergunta_colher: o cardápio pergunta "Deseja colher?" (Sim/Não,
--   obrigatório) ao adicionar o produto. Começa ligado em todos; o admin desliga
--   onde não faz sentido (ex.: bebidas). Combos perguntam se algum produto do
--   combo pergunta.
-- * A resposta do cliente fica no item do pedido (pedidos.itens[].colher, jsonb):
--   true = quer colher, false = não quer, ausente = produto não pergunta.
--   Não precisa de coluna nova em pedidos.
--
-- Rollback: supabase/rollbacks/0020_produtos_pergunta_colher.sql

BEGIN;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS pergunta_colher boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.produtos.pergunta_colher IS
  'Cardápio pergunta ao cliente se deseja colher (resposta em pedidos.itens[].colher).';

COMMIT;
