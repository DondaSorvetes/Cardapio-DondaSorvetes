-- 0019 — Entregadores (app mobile dos entregadores)
--
-- * Tabela própria public.entregadores, FORA de public.perfis: no painel, qualquer
--   role desconhecido em perfis vira "atendente" (resolveAdminRole) e ganharia o
--   Kanban. Entregador nunca tem perfil de equipe (garantido por trigger).
-- * pedidos ganha entregador_id, saiu_entrega_at e entregue_at. Nenhum status novo.
-- * Atribuição automática NO BANCO, na mesma operação que muda o status para
--   'saiu_entrega' (qualquer caminho: Kanban, API, futuro), só para pedidos de
--   entrega, só se houver entregador selecionado. Trocar o selecionado não move
--   pedidos já atribuídos. Voltar para pendente/confirmado/preparando desatribui.
-- * O app NÃO lê nem altera public.pedidos diretamente (nenhuma policy nova em
--   pedidos): só pelas funções entregador_* (SECURITY DEFINER, campos limitados).
-- * Tempo real: o banco avisa no canal privado "entregador:<id>" que a lista mudou
--   (sem dados do pedido); o app busca de novo pela função.
--
-- Rollback: supabase/rollbacks/0019_entregadores.sql

BEGIN;

-- ── 1. Entregadores ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entregadores (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 1 AND 80),
  email text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  -- Responsável pelas entregas agora (um por vez, só se ativo).
  selecionado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entregadores_selecionado_exige_ativo CHECK (NOT selecionado OR ativo)
);

COMMENT ON TABLE public.entregadores IS
  'Entregadores do app mobile (Auth UUID). Separado de perfis: entregador não acessa o painel.';

CREATE UNIQUE INDEX IF NOT EXISTS entregadores_um_selecionado
  ON public.entregadores ((true)) WHERE selecionado;
CREATE UNIQUE INDEX IF NOT EXISTS entregadores_email_idx
  ON public.entregadores (lower(email));

ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;
-- Sem policies: só o servidor (service_role) e as funções abaixo acessam.
REVOKE ALL ON public.entregadores FROM anon, authenticated;
GRANT ALL ON public.entregadores TO service_role;

CREATE OR REPLACE FUNCTION public.softshake_entregadores_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = NEW.id) THEN
    RAISE EXCEPTION 'CONTA_DA_EQUIPE' USING
      ERRCODE = '23514',
      DETAIL = 'Esta conta já é da equipe do painel e não pode ser entregador.';
  END IF;
  IF NOT NEW.ativo THEN
    NEW.selecionado := false;
  END IF;
  NEW.email := lower(btrim(NEW.email));
  NEW.nome := btrim(NEW.nome);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entregadores_guard ON public.entregadores;
CREATE TRIGGER entregadores_guard
  BEFORE INSERT OR UPDATE ON public.entregadores
  FOR EACH ROW EXECUTE FUNCTION public.softshake_entregadores_guard();

-- ── 2. Pedidos: atribuição e horários ──────────────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS entregador_id uuid REFERENCES public.entregadores (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS saiu_entrega_at timestamptz,
  ADD COLUMN IF NOT EXISTS entregue_at timestamptz;

CREATE INDEX IF NOT EXISTS pedidos_entregas_pendentes_idx
  ON public.pedidos (entregador_id, saiu_entrega_at)
  WHERE status = 'saiu_entrega';

CREATE OR REPLACE FUNCTION public.softshake_pedido_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'saiu_entrega' THEN
    NEW.saiu_entrega_at := now();
    NEW.entregue_at := NULL;
    -- Só na transição para "saiu para entrega", só entrega (não retirada) e só se
    -- ainda não tiver entregador (ex.: voltou de "entregue" por correção).
    IF NEW.tipo_entrega = 'entrega' AND NEW.entregador_id IS NULL THEN
      SELECT e.id INTO NEW.entregador_id
      FROM public.entregadores e
      WHERE e.selecionado AND e.ativo
      LIMIT 1;
    END IF;
  ELSIF NEW.status = 'entregue' THEN
    NEW.entregue_at := coalesce(NEW.entregue_at, now());
  ELSIF NEW.status IN ('pendente', 'confirmado', 'preparando') THEN
    -- Voltou para antes da entrega: ao sair de novo vai para o selecionado da vez.
    NEW.entregador_id := NULL;
    NEW.saiu_entrega_at := NULL;
    NEW.entregue_at := NULL;
  END IF;
  -- 'cancelado': mantém o histórico; o pedido some do app (status).
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_entrega ON public.pedidos;
CREATE TRIGGER pedidos_entrega
  BEFORE UPDATE OF status ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.softshake_pedido_entrega();

-- ── 3. Tempo real: aviso no canal privado do entregador ────────────────────
CREATE OR REPLACE FUNCTION public.softshake_avisar_entregador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  alvo uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.entregador_id IS NOT DISTINCT FROM OLD.entregador_id THEN
    RETURN NULL;
  END IF;
  FOR alvo IN
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.entregador_id END,
      NEW.entregador_id
    ]) AS x WHERE x IS NOT NULL
  LOOP
    BEGIN
      -- Só o aviso: o app busca os dados pela função, com os campos permitidos.
      PERFORM realtime.send(
        jsonb_build_object('pedido_id', NEW.id),
        'entregas_mudaram',
        'entregador:' || alvo::text,
        true
      );
    EXCEPTION WHEN OTHERS THEN
      -- Aviso em tempo real nunca pode impedir a mudança do pedido.
      NULL;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_avisar_entregador ON public.pedidos;
CREATE TRIGGER pedidos_avisar_entregador
  AFTER UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.softshake_avisar_entregador();

-- O entregador não lê public.entregadores: a policy do canal pergunta por aqui.
CREATE OR REPLACE FUNCTION public.softshake_eh_entregador_ativo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.entregadores e WHERE e.id = auth.uid() AND e.ativo);
$$;

-- Quem pode ouvir o canal privado: só o próprio entregador, ativo.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS entregador_ouve_proprio_canal ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY entregador_ouve_proprio_canal ON realtime.messages
        FOR SELECT TO authenticated
        USING (
          realtime.messages.extension = 'broadcast'
          AND (SELECT realtime.topic()) = 'entregador:' || (SELECT auth.uid())::text
          AND (SELECT public.softshake_eh_entregador_ativo())
        )
    $p$;
  END IF;
END $$;

-- ── 4. Funções do app do entregador ────────────────────────────────────────
-- Entregador logado e ativo; senão erro (o app mostra "sem acesso").
CREATE OR REPLACE FUNCTION public.softshake_entregador_logado()
RETURNS public.entregadores
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.entregadores;
BEGIN
  SELECT * INTO e FROM public.entregadores WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NAO_ENTREGADOR' USING ERRCODE = '42501';
  END IF;
  IF NOT e.ativo THEN
    RAISE EXCEPTION 'ENTREGADOR_INATIVO' USING ERRCODE = '42501';
  END IF;
  RETURN e;
END;
$$;

CREATE OR REPLACE FUNCTION public.entregador_perfil()
RETURNS TABLE (id uuid, nome text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.entregadores := public.softshake_entregador_logado();
BEGIN
  RETURN QUERY SELECT e.id, e.nome;
END;
$$;

-- Entregas pendentes do entregador logado, só com o necessário para entregar.
CREATE OR REPLACE FUNCTION public.entregador_minhas_entregas()
RETURNS TABLE (
  id uuid,
  numero text,
  cliente_nome text,
  cliente_telefone text,
  endereco jsonb,
  observacoes text,
  itens jsonb,
  meio_pagamento text,
  total numeric,
  troco_para text,
  saiu_entrega_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.entregadores := public.softshake_entregador_logado();
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    upper(left(p.id::text, 8)),
    p.cliente_nome,
    p.cliente_telefone,
    p.endereco_completo,
    p.observacoes,
    -- Resumo para conferência: quantidade, nome e observação de cada item.
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'qtd', coalesce((i ->> 'qty')::int, 1),
        'nome', coalesce(i -> 'produto' ->> 'name', i ->> 'nome', 'Item'),
        'obs', nullif(btrim(coalesce(i ->> 'observacoes', '')), '')
      ))
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.itens) = 'array' THEN p.itens ELSE '[]'::jsonb END) AS i
    ), '[]'::jsonb),
    p.meio_pagamento,
    p.total,
    p.troco_para,
    p.saiu_entrega_at
  FROM public.pedidos p
  WHERE p.entregador_id = e.id
    AND p.status = 'saiu_entrega'
  ORDER BY p.saiu_entrega_at NULLS LAST, p.created_at;
END;
$$;

-- Concluir entrega: só pedido do próprio entregador, em "saiu para entrega".
-- Idempotente: repetir (toque duplo, rede instável) não faz uma segunda alteração.
CREATE OR REPLACE FUNCTION public.entregador_concluir_entrega(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.entregadores;
  concluido timestamptz;
  atual record;
BEGIN
  -- Trava a linha do entregador: desativação concorrente espera ou vence.
  SELECT * INTO e FROM public.entregadores WHERE id = auth.uid() FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NAO_ENTREGADOR' USING ERRCODE = '42501';
  END IF;
  IF NOT e.ativo THEN
    RAISE EXCEPTION 'ENTREGADOR_INATIVO' USING ERRCODE = '42501';
  END IF;

  UPDATE public.pedidos p
     SET status = 'entregue', entregue_at = now()
   WHERE p.id = p_pedido_id
     AND p.entregador_id = e.id
     AND p.status = 'saiu_entrega'
  RETURNING p.entregue_at INTO concluido;

  IF FOUND THEN
    INSERT INTO public.audit_logs (actor_id, actor_email, action, entity, entity_id, after, result)
    VALUES (e.id::text, e.email, 'pedido.entregue_pelo_entregador', 'pedidos', p_pedido_id::text,
            jsonb_build_object('status', 'entregue', 'entregue_at', concluido), 'ok');
    RETURN jsonb_build_object('ok', true, 'ja_concluido', false, 'entregue_at', concluido);
  END IF;

  SELECT p.status, p.entregador_id, p.entregue_at INTO atual
  FROM public.pedidos p WHERE p.id = p_pedido_id;
  IF FOUND AND atual.entregador_id = e.id AND atual.status = 'entregue' THEN
    RETURN jsonb_build_object('ok', true, 'ja_concluido', true, 'entregue_at', atual.entregue_at);
  END IF;
  -- Não existe, é de outro entregador, foi cancelado ou voltou de status.
  RAISE EXCEPTION 'PEDIDO_INDISPONIVEL' USING ERRCODE = 'P0002';
END;
$$;

-- ── 5. Seleção do entregador ativo (só o servidor do painel) ────────────────
CREATE OR REPLACE FUNCTION public.admin_selecionar_entregador(p_entregador_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Serializa trocas simultâneas de dois administradores.
  PERFORM pg_advisory_xact_lock(hashtext('softshake:entregador_selecionado'));
  IF p_entregador_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.entregadores WHERE id = p_entregador_id AND ativo
  ) THEN
    RAISE EXCEPTION 'ENTREGADOR_INVALIDO' USING ERRCODE = 'P0002';
  END IF;
  -- Duas etapas: o índice único não pode ver dois selecionados no meio do UPDATE.
  UPDATE public.entregadores SET selecionado = false
   WHERE selecionado AND id IS DISTINCT FROM p_entregador_id;
  IF p_entregador_id IS NOT NULL THEN
    UPDATE public.entregadores SET selecionado = true WHERE id = p_entregador_id;
  END IF;
END;
$$;

-- ── 6. Permissões das funções ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.softshake_entregadores_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.softshake_pedido_entrega() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.softshake_avisar_entregador() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.softshake_entregador_logado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_selecionar_entregador(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_selecionar_entregador(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.softshake_eh_entregador_ativo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.softshake_eh_entregador_ativo() TO authenticated;

REVOKE ALL ON FUNCTION public.entregador_perfil() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.entregador_minhas_entregas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.entregador_concluir_entrega(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entregador_perfil() TO authenticated;
GRANT EXECUTE ON FUNCTION public.entregador_minhas_entregas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.entregador_concluir_entrega(uuid) TO authenticated;

COMMIT;
