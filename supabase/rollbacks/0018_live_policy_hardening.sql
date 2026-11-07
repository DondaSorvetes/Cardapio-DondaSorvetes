-- Emergency rollback: restores the exact pre-0018 policies, including their former risks.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM donda_security.policy_backups WHERE migration='0018') THEN RAISE EXCEPTION '0018 snapshot missing'; END IF;
END $$;
DROP POLICY IF EXISTS pedidos_select_sec0018 ON public.pedidos;
DROP POLICY IF EXISTS clientes_select_sec0018 ON public.clientes;
DROP POLICY IF EXISTS audit_logs_select_sec0018 ON public.audit_logs;
DROP POLICY IF EXISTS perfis_select_sec0018 ON public.perfis;
DO $$ DECLARE p jsonb; BEGIN
 FOR p IN SELECT jsonb_array_elements(policies) FROM donda_security.policy_backups WHERE migration='0018' LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p->>'name',p->>'table');
  EXECUTE p->>'ddl';
 END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.donda_staff_can_v2(text);
COMMIT;
