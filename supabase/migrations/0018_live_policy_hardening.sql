-- Adapted to the actual policies supplied by the store operator.
-- Execute after backup, preferably validated in a staging project first.
-- Standalone: does not require 0016/0017. All application writes use authorized service-role routes/actions.
BEGIN;
CREATE SCHEMA IF NOT EXISTS softshake_security;
REVOKE ALL ON SCHEMA softshake_security FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS softshake_security.policy_backups (migration text PRIMARY KEY, policies jsonb NOT NULL);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename IN ('pedidos','clientes','audit_logs','perfis')
    AND NOT (
      (p.tablename='pedidos' AND p.policyname IN ('RLS_pedidos','pedidos_select_authenticated','pedidos_insert_authenticated','pedidos_update_authenticated','pedidos_select_staff_scoped','pedidos_select_sec0018'))
      OR (p.tablename='clientes' AND p.policyname IN ('Clientes podem atualizar próprio perfil','Clientes podem ler próprio perfil','RLS_clientes','clientes_insert','clientes_select','clientes_select_authenticated','clientes_update','clientes_select_staff_scoped','clientes_select_sec0018'))
      OR (p.tablename='audit_logs' AND p.policyname IN ('RLS_logs','audit_logs_select_authenticated','audit_logs_select_staff_scoped','audit_logs_select_sec0018'))
      OR (p.tablename='perfis' AND p.policyname IN ('RLS_perfis','perfis_select_admin','perfis_select_own','perfis_update_admin','perfis_select_sec0018'))
    )
  ) THEN RAISE EXCEPTION 'Policies changed: export and review them before applying 0018'; END IF;
END $$;
-- Save the exact definitions for rollback, including PUBLIC policies and Unicode names.
INSERT INTO softshake_security.policy_backups(migration,policies)
SELECT '0018', COALESCE(jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'ddl',format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',policyname,schemaname,tablename,permissive,cmd,(SELECT string_agg(CASE WHEN r='public' THEN 'PUBLIC' ELSE quote_ident(r) END,', ') FROM unnest(roles) r),CASE WHEN qual IS NULL THEN '' ELSE ' USING ('||qual||')' END,CASE WHEN with_check IS NULL THEN '' ELSE ' WITH CHECK ('||with_check||')' END))), '[]'::jsonb)
FROM pg_policies WHERE schemaname='public' AND tablename IN ('pedidos','clientes','audit_logs','perfis')
ON CONFLICT(migration) DO NOTHING;
CREATE OR REPLACE FUNCTION public.softshake_staff_can_v2(capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id=auth.uid() AND lower(p.role) IN ('admin','gerente','atendente') AND (
   lower(p.role)='admin'
   OR capability='pedido:read'
   OR (capability='cliente:read' AND (lower(p.role)='gerente' OR p.acessos && ARRAY['clientes']::text[] OR p.permissoes && ARRAY['cliente:read','cliente:write']::text[]))
   OR (capability='admin:manage' AND 'admin:manage'=ANY(p.permissoes))
  )
 );
$$;
REVOKE ALL ON FUNCTION public.softshake_staff_can_v2(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.softshake_staff_can_v2(text) TO authenticated, service_role;
-- With no authenticated INSERT/UPDATE/DELETE policies, protected fields cannot be changed directly.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('pedidos','clientes','audit_logs','perfis') LOOP
  EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
END $$;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedidos_select_sec0018 ON public.pedidos FOR SELECT TO authenticated USING(public.softshake_staff_can_v2('pedido:read'));
CREATE POLICY clientes_select_sec0018 ON public.clientes FOR SELECT TO authenticated USING(id=auth.uid() OR public.softshake_staff_can_v2('cliente:read'));
CREATE POLICY audit_logs_select_sec0018 ON public.audit_logs FOR SELECT TO authenticated USING(public.softshake_staff_can_v2('admin:manage'));
CREATE POLICY perfis_select_sec0018 ON public.perfis FOR SELECT TO authenticated USING(id=auth.uid() OR public.softshake_staff_can_v2('admin:manage'));
COMMIT;
