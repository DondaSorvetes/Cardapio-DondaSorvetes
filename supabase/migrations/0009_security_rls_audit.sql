-- ============================================================
-- SoftShake · Segurança: audit_logs + reforço RLS
-- Execute no SQL Editor do Supabase após backup.
-- ============================================================

-- 1) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id TEXT NULL,
  actor_email TEXT NULL,
  action TEXT NOT NULL,
  entity TEXT NULL,
  entity_id TEXT NULL,
  ip TEXT NULL,
  before JSONB NULL,
  after JSONB NULL,
  result TEXT NULL DEFAULT 'ok',
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas service role / backend escreve; authenticated admin pode ler
DROP POLICY IF EXISTS audit_logs_select_authenticated ON public.audit_logs;
CREATE POLICY audit_logs_select_authenticated
  ON public.audit_logs FOR SELECT TO authenticated
  USING (true);

-- Insert via service role (bypassa RLS) — sem policy pública de insert

-- 2) Cardápio: leitura pública (anon) — escrita só service role
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'produtos', 'categorias', 'tags', 'grupos_opcoes', 'opcoes',
    'produto_grupos', 'configuracoes_loja'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_public', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
        t || '_select_public', t
      );

      -- Remove writes públicas se existirem
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write_public', t);
    END IF;
  END LOOP;
END $$;

-- 3) Pedidos: cliente só vê os próprios; authenticated admin via service role no backend
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_select_own ON public.pedidos;
-- Nota: clientes usam JWT custom (não Supabase Auth). Backend usa service role.
-- Policy para Supabase Auth (admin):
DROP POLICY IF EXISTS pedidos_select_authenticated ON public.pedidos;
CREATE POLICY pedidos_select_authenticated
  ON public.pedidos FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_insert_authenticated ON public.pedidos;
CREATE POLICY pedidos_insert_authenticated
  ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS pedidos_update_authenticated ON public.pedidos;
CREATE POLICY pedidos_update_authenticated
  ON public.pedidos FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- 4) Clientes: sem acesso anon
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clientes_select_authenticated ON public.clientes;
CREATE POLICY clientes_select_authenticated
  ON public.clientes FOR SELECT TO authenticated
  USING (true);

-- 5) Admins (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admins'
  ) THEN
    ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS admins_select_authenticated ON public.admins;
    CREATE POLICY admins_select_authenticated
      ON public.admins FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.audit_logs IS
  'Auditoria de ações críticas (admin, pedidos, segurança). Escrita via service role.';
