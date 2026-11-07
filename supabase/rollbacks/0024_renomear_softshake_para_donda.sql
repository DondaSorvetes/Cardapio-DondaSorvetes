-- Rollback da 0024: volta os nomes donda_* para softshake_*.
-- (O nome da loja não é revertido: ajuste no painel se precisar.)
BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura, p.proname AS nome
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'donda_staff_can', 'donda_staff_can_v2', 'donda_entregadores_guard',
        'donda_pedido_entrega', 'donda_avisar_entregador',
        'donda_eh_entregador_ativo', 'donda_entregador_logado'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s RENAME TO %I',
      r.assinatura,
      'softshake_' || substr(r.nome, length('donda_') + 1)
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'donda_security') THEN
    ALTER SCHEMA donda_security RENAME TO softshake_security;
  END IF;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND (p.prosrc LIKE '%donda_entregador_logado%' OR p.prosrc LIKE '%donda:entregador_selecionado%')
  LOOP
    EXECUTE replace(
      replace(pg_get_functiondef(r.oid), 'donda_entregador_logado', 'softshake_entregador_logado'),
      'donda:entregador_selecionado', 'softshake:entregador_selecionado'
    );
  END LOOP;
END;
$$;

COMMIT;
