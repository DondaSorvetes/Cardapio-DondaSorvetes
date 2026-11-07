-- ============================================================
-- SoftShake Online - Setup Completo do Banco de Dados
-- Execute este script no SQL Editor do Supabase Dashboard
-- ============================================================

-- ============================================================
-- 1. TABELAS PRINCIPAIS
-- ============================================================

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  email text,
  telefone text,
  endereco text,
  enderecos_adicionais jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS public.categorias (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  ordem integer
);

-- Tabela de tags
CREATE TABLE IF NOT EXISTS public.tags (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  cor_fundo text NOT NULL,
  cor_texto text
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  preco_base numeric(10,2) NOT NULL,
  preco_promocional numeric(10,2),
  imagem_url text,
  categoria_id integer REFERENCES public.categorias(id) ON DELETE SET NULL,
  tag_id integer REFERENCES public.tags(id) ON DELETE SET NULL,
  esta_disponivel boolean DEFAULT true,
  ordem integer
);

-- Tabela de grupos de opções
CREATE TABLE IF NOT EXISTS public.grupos_opcoes (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  min_escolha integer DEFAULT 0,
  max_escolha integer NOT NULL,
  tag_id integer REFERENCES public.tags(id) ON DELETE SET NULL
);

-- Tabela de opções
CREATE TABLE IF NOT EXISTS public.opcoes (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  preco_adicional numeric(10,2) DEFAULT 0,
  grupo_id integer REFERENCES public.grupos_opcoes(id) ON DELETE CASCADE,
  tag_id integer REFERENCES public.tags(id) ON DELETE SET NULL,
  ordem integer,
  status text DEFAULT 'disponivel',
  esta_disponivel boolean DEFAULT true
);

-- Tabela intermediária produto-grupos
CREATE TABLE IF NOT EXISTS public.produto_grupos (
  produto_id integer REFERENCES public.produtos(id) ON DELETE CASCADE,
  grupo_id integer REFERENCES public.grupos_opcoes(id) ON DELETE CASCADE,
  ordem integer,
  PRIMARY KEY (produto_id, grupo_id)
);

-- Tabela de configurações da loja
CREATE TABLE IF NOT EXISTS public.configuracoes_loja (
  id serial PRIMARY KEY,
  nome text NOT NULL DEFAULT 'Minha Loja',
  descricao text,
  logo_url text,
  banner_url text,
  telefone text,
  whatsapp text,
  instagram text,
  facebook text,
  endereco text,
  cidade text,
  estado text,
  horario_abertura text,
  horario_fechamento text,
  dias_funcionamento text,
  esta_aberto boolean DEFAULT true,
  aceitando_pedidos boolean DEFAULT true,
  aceitar_pedidos_automaticamente boolean DEFAULT false,
  pedido_minimo numeric(10,2) DEFAULT 0,
  taxa_entrega numeric(10,2) DEFAULT 0,
  tempo_entrega_min integer DEFAULT 30,
  tempo_entrega_max integer DEFAULT 60
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cliente_telefone text NOT NULL,
  tipo_entrega text NOT NULL,
  endereco_id uuid,
  endereco_completo jsonb,
  meio_pagamento text NOT NULL,
  troco_para text,
  subtotal numeric(10,2) NOT NULL,
  taxa_entrega numeric(10,2) DEFAULT 0,
  total numeric(10,2) NOT NULL,
  itens jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. TABELA DE AUDITORIA
-- ============================================================

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

-- ============================================================
-- 3. PREFERÊNCIAS DO ESTABELECIMENTO
-- ============================================================

ALTER TABLE configuracoes_loja
  ADD COLUMN IF NOT EXISTS finalizar_pedidos_apos_24h boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalizar_agendados_apos_3_dias boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS imprimir_aceitar_automaticamente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificar_novos_pedidos boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS som_alerta_ativo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS som_alerta_tipo text DEFAULT 'classico',
  ADD COLUMN IF NOT EXISTS som_alerta_volume integer DEFAULT 70,
  ADD COLUMN IF NOT EXISTS proximo_numero_pedido integer DEFAULT 1;

-- ============================================================
-- 4. TABELA DE PERFIS (RBAC)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nome text,
  email text,
  role text NOT NULL DEFAULT 'atendente'
    CHECK (role IN ('admin', 'gerente', 'atendente')),
  acessos text[] DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Adiciona colunas extras se a tabela já existia
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS nome text;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS acessos text[] DEFAULT NULL;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS permissoes text[] DEFAULT NULL;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Atualiza perfis existentes
UPDATE public.perfis
SET role = 'atendente'
WHERE role IS NULL OR btrim(role) = '';

-- Define acessos padrão para atendentes
UPDATE public.perfis
SET acessos = ARRAY['pedidos']::text[]
WHERE lower(role) = 'atendente'
  AND (acessos IS NULL OR cardinality(acessos) = 0);

CREATE INDEX IF NOT EXISTS perfis_role_idx ON public.perfis (role);
CREATE INDEX IF NOT EXISTS perfis_email_idx ON public.perfis (email);

-- ============================================================
-- 5. FUNÇÕES DE SEGURANÇA
-- ============================================================

-- Helper SECURITY DEFINER para verificar se é admin
CREATE OR REPLACE FUNCTION public.is_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis p
    WHERE p.id = auth.uid()
      AND lower(p.role) = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_admin() TO authenticated;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.set_perfis_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_opcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;

-- Policies para audit_logs
DROP POLICY IF EXISTS audit_logs_select_authenticated ON public.audit_logs;
CREATE POLICY audit_logs_select_authenticated
  ON public.audit_logs FOR SELECT TO authenticated
  USING (true);

-- Policies para perfis
DROP POLICY IF EXISTS perfis_select_own ON public.perfis;
CREATE POLICY perfis_select_own
  ON public.perfis FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS perfis_select_admin ON public.perfis;
CREATE POLICY perfis_select_admin
  ON public.perfis FOR SELECT TO authenticated
  USING (public.is_staff_admin());

DROP POLICY IF EXISTS perfis_update_admin ON public.perfis;
CREATE POLICY perfis_update_admin
  ON public.perfis FOR UPDATE TO authenticated
  USING (public.is_staff_admin())
  WITH CHECK (public.is_staff_admin());

-- Policies para cardápio (leitura pública)
DROP POLICY IF EXISTS produtos_select_public ON public.produtos;
CREATE POLICY produtos_select_public
  ON public.produtos FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS categorias_select_public ON public.categorias;
CREATE POLICY categorias_select_public
  ON public.categorias FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS tags_select_public ON public.tags;
CREATE POLICY tags_select_public
  ON public.tags FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS grupos_opcoes_select_public ON public.grupos_opcoes;
CREATE POLICY grupos_opcoes_select_public
  ON public.grupos_opcoes FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS opcoes_select_public ON public.opcoes;
CREATE POLICY opcoes_select_public
  ON public.opcoes FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS produto_grupos_select_public ON public.produto_grupos;
CREATE POLICY produto_grupos_select_public
  ON public.produto_grupos FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS configuracoes_loja_select_public ON public.configuracoes_loja;
CREATE POLICY configuracoes_loja_select_public
  ON public.configuracoes_loja FOR SELECT TO anon, authenticated
  USING (true);

-- Policies para pedidos (authenticated admin)
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

-- Policies para clientes
DROP POLICY IF EXISTS clientes_select_authenticated ON public.clientes;
CREATE POLICY clientes_select_authenticated
  ON public.clientes FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS perfis_set_updated_at ON public.perfis;
CREATE TRIGGER perfis_set_updated_at
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.set_perfis_updated_at();

-- ============================================================
-- 8. DADOS INICIAIS
-- ============================================================

-- Insere configuração padrão da loja
INSERT INTO public.configuracoes_loja (
  id,
  nome,
  descricao,
  esta_aberto,
  aceitando_pedidos,
  pedido_minimo,
  taxa_entrega,
  tempo_entrega_min,
  tempo_entrega_max
)
VALUES (
  1,
  'SoftShake Online',
  'Sua loja de delivery',
  true,
  true,
  0,
  5.00,
  30,
  60
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE public.perfis IS
  'Perfis do painel admin (Auth UUID + role + telas liberadas).';
COMMENT ON COLUMN public.perfis.acessos IS
  'Telas do painel liberadas (dashboard, pedidos, catalogo, ...). NULL = defaults do role.';

COMMENT ON TABLE public.audit_logs IS
  'Auditoria de ações críticas (admin, pedidos, segurança). Escrita via service role.';

COMMENT ON COLUMN configuracoes_loja.finalizar_pedidos_apos_24h IS
  'Finaliza automaticamente pedidos em aberto há mais de 24 horas';
COMMENT ON COLUMN configuracoes_loja.finalizar_agendados_apos_3_dias IS
  'Finaliza pedidos agendados 3 dias após a data agendada';
COMMENT ON COLUMN configuracoes_loja.imprimir_aceitar_automaticamente IS
  'Aceita e imprime novos pedidos automaticamente';
COMMENT ON COLUMN configuracoes_loja.notificar_novos_pedidos IS
  'Exibe notificações de novos pedidos no painel';
COMMENT ON COLUMN configuracoes_loja.som_alerta_ativo IS
  'Toca som de alerta ao chegar pedido';
COMMENT ON COLUMN configuracoes_loja.som_alerta_tipo IS
  'Identificador do som de alerta (classico, suave, urgente)';
COMMENT ON COLUMN configuracoes_loja.som_alerta_volume IS
  'Volume do alerta 0-100';
COMMENT ON COLUMN configuracoes_loja.proximo_numero_pedido IS
  'Próximo número sequencial de pedido (exibição/contagem)';

-- ============================================================
-- ✅ SETUP COMPLETO!
-- ============================================================

SELECT 'Setup do banco de dados concluído com sucesso!' as status;
