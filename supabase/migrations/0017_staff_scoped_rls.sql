-- STAGING ONLY until the actual policies/grants and realtime flows are reviewed.
-- Saves exact target policies for rollback. Aborts rather than overriding unknown policies.
BEGIN;
CREATE SCHEMA IF NOT EXISTS softshake_security;
REVOKE ALL ON SCHEMA softshake_security FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS softshake_security.policy_backups (migration text PRIMARY KEY, policies jsonb NOT NULL);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('pedidos','clientes','audit_logs') AND policyname NOT IN ('pedidos_select_authenticated','pedidos_insert_authenticated','pedidos_update_authenticated','clientes_select_authenticated','audit_logs_select_authenticated','pedidos_select_staff_scoped','clientes_select_staff_scoped','audit_logs_select_staff_scoped')) THEN
    RAISE EXCEPTION 'Unexpected policies: export/review policies and grants before applying 0017';
  END IF;
END $$;
INSERT INTO softshake_security.policy_backups(migration,policies)
SELECT '0017', COALESCE(jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'ddl',format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',policyname,schemaname,tablename,permissive,cmd,(SELECT string_agg(CASE WHEN r='public' THEN 'PUBLIC' ELSE quote_ident(r) END,', ') FROM unnest(roles) r),CASE WHEN qual IS NULL THEN '' ELSE ' USING ('||qual||')' END,CASE WHEN with_check IS NULL THEN '' ELSE ' WITH CHECK ('||with_check||')' END))), '[]'::jsonb)
FROM pg_policies WHERE schemaname='public' AND tablename IN ('pedidos','clientes','audit_logs')
ON CONFLICT(migration) DO NOTHING;
CREATE OR REPLACE FUNCTION public.softshake_staff_can(capability text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.perfis p WHERE p.id=auth.uid() AND lower(p.role) IN ('admin','gerente','atendente') AND (
   lower(p.role)='admin'
   OR (capability='pedido:read')
   OR (capability='cliente:read' AND (lower(p.role)='gerente' OR p.acessos && ARRAY['clientes']::text[] OR p.permissoes && ARRAY['cliente:read','cliente:write']::text[]))
   OR (capability='admin:manage' AND 'admin:manage'=ANY(p.permissoes))
 ));
$$;
REVOKE ALL ON FUNCTION public.softshake_staff_can(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.softshake_staff_can(text) TO authenticated, service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pedidos_select_authenticated ON public.pedidos;
DROP POLICY IF EXISTS pedidos_insert_authenticated ON public.pedidos;
DROP POLICY IF EXISTS pedidos_update_authenticated ON public.pedidos;
DROP POLICY IF EXISTS clientes_select_authenticated ON public.clientes;
DROP POLICY IF EXISTS audit_logs_select_authenticated ON public.audit_logs;
DROP POLICY IF EXISTS pedidos_select_staff_scoped ON public.pedidos;
DROP POLICY IF EXISTS clientes_select_staff_scoped ON public.clientes;
DROP POLICY IF EXISTS audit_logs_select_staff_scoped ON public.audit_logs;
CREATE POLICY pedidos_select_staff_scoped ON public.pedidos FOR SELECT TO authenticated USING(public.softshake_staff_can('pedido:read'));
CREATE POLICY clientes_select_staff_scoped ON public.clientes FOR SELECT TO authenticated USING(id=auth.uid() OR public.softshake_staff_can('cliente:read'));
CREATE POLICY audit_logs_select_staff_scoped ON public.audit_logs FOR SELECT TO authenticated USING(public.softshake_staff_can('admin:manage'));
COMMIT;
