-- 0024 — Tira o nome SoftShake do banco (funções, schema interno e nome da loja).
--
-- * ALTER FUNCTION ... RENAME mantém o mesmo OID: políticas RLS, triggers e
--   GRANTs continuam apontando para a função certa, sem recriar nada.
-- * Funções cujo CORPO chama outra pelo nome (ex.: entregador_perfil chama
--   softshake_entregador_logado) são recriadas com o texto atualizado, a partir
--   da própria definição no banco (pg_get_functiondef), sem copiar SQL antigo.
-- * Idempotente: pode rodar de novo sem erro.
--
-- Rollback: supabase/rollbacks/0024_renomear_softshake_para_donda.sql

BEGIN;

-- 1. Funções public.softshake_* → public.donda_*
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura, p.proname AS nome
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'softshake\_%'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s RENAME TO %I',
      r.assinatura,
      'donda_' || substr(r.nome, length('softshake_') + 1)
    );
  END LOOP;
END;
$$;

-- 2. Schema interno de backups de políticas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'softshake_security')
     AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'donda_security') THEN
    ALTER SCHEMA softshake_security RENAME TO donda_security;
  END IF;
END;
$$;

-- 3. Corpos de função que ainda citam "softshake" (chamadas por nome e a
--    chave da trava de seleção do entregador) são recriados com "donda".
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosrc ILIKE '%softshake%'
  LOOP
    EXECUTE replace(pg_get_functiondef(r.oid), 'softshake', 'donda');
  END LOOP;
END;
$$;

-- 4. Nome antigo da loja (seed do setup inicial), só se ainda não foi trocado.
UPDATE public.configuracoes_loja
   SET nome = 'Sorvetes Donda'
 WHERE nome = 'SoftShake Online';

-- Conferência: nada mais com "softshake" em funções do schema public.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname ILIKE '%softshake%' OR p.prosrc ILIKE '%softshake%')
  ) THEN
    RAISE EXCEPTION 'Ainda há funções com "softshake" no schema public';
  END IF;
END;
$$;

COMMIT;
