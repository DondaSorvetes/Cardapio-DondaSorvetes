-- Restores exactly the policies captured by migration 0017, not a guessed baseline.
BEGIN;
DROP POLICY IF EXISTS pedidos_select_staff_scoped ON public.pedidos;
DROP POLICY IF EXISTS clientes_select_staff_scoped ON public.clientes;
DROP POLICY IF EXISTS audit_logs_select_staff_scoped ON public.audit_logs;
DO $$ DECLARE p jsonb; BEGIN
 IF NOT EXISTS (SELECT 1 FROM donda_security.policy_backups WHERE migration='0017') THEN RAISE EXCEPTION 'Policy snapshot missing'; END IF;
 FOR p IN SELECT jsonb_array_elements(policies) FROM donda_security.policy_backups WHERE migration='0017' LOOP
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p->>'name',p->>'table');
   EXECUTE p->>'ddl';
 END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.donda_staff_can(text);
COMMIT;
