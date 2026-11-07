-- Rollback de 0019_entregadores.sql.
-- ATENÇÃO: apaga o cadastro de entregadores e as colunas de atribuição/horários dos
-- pedidos (entregador_id, saiu_entrega_at, entregue_at). Os pedidos e seus status
-- continuam intactos. As contas no Supabase Auth NÃO são apagadas.
BEGIN;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS entregador_ouve_proprio_canal ON realtime.messages';
  END IF;
END $$;

DROP TRIGGER IF EXISTS pedidos_avisar_entregador ON public.pedidos;
DROP TRIGGER IF EXISTS pedidos_entrega ON public.pedidos;

DROP FUNCTION IF EXISTS public.entregador_concluir_entrega(uuid);
DROP FUNCTION IF EXISTS public.entregador_minhas_entregas();
DROP FUNCTION IF EXISTS public.entregador_perfil();
DROP FUNCTION IF EXISTS public.admin_selecionar_entregador(uuid);
DROP FUNCTION IF EXISTS public.donda_entregador_logado();
DROP FUNCTION IF EXISTS public.donda_eh_entregador_ativo();
DROP FUNCTION IF EXISTS public.donda_avisar_entregador();
DROP FUNCTION IF EXISTS public.donda_pedido_entrega();

DROP INDEX IF EXISTS public.pedidos_entregas_pendentes_idx;
ALTER TABLE public.pedidos
  DROP COLUMN IF EXISTS entregue_at,
  DROP COLUMN IF EXISTS saiu_entrega_at,
  DROP COLUMN IF EXISTS entregador_id;

DROP TABLE IF EXISTS public.entregadores;
DROP FUNCTION IF EXISTS public.donda_entregadores_guard();

COMMIT;
