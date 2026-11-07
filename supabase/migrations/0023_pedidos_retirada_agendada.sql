-- 0023 — Retirada agendada
-- Cliente que retira no estabelecimento escolhe "Agora" (agendado_para NULL) ou
-- uma janela de 15 min (agendado_para = início da janela).
-- Retirada usa o status 'saiu_entrega' como "Pronto para retirada" (o trigger de
-- entregadores só atribui entregador quando tipo_entrega = 'entrega').
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS agendado_para timestamptz;

CREATE INDEX IF NOT EXISTS pedidos_agendado_para_idx
  ON public.pedidos (agendado_para)
  WHERE agendado_para IS NOT NULL;
