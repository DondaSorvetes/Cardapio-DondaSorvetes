-- Perfis: staff do painel (tabela public.perfis)
-- Campos: id (auth.users), nome, email, role, acessos (telas liberadas)

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

-- Se a tabela já existia, garante colunas extras
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

UPDATE public.perfis
SET role = 'atendente'
WHERE role IS NULL OR btrim(role) = '';

-- Atendente: só pedidos por padrão
UPDATE public.perfis
SET acessos = ARRAY['pedidos']::text[]
WHERE lower(role) = 'atendente'
  AND (acessos IS NULL OR cardinality(acessos) = 0);

COMMENT ON TABLE public.perfis IS
  'Perfis do painel admin (Auth UUID + role + telas liberadas).';
COMMENT ON COLUMN public.perfis.acessos IS
  'Telas do painel liberadas (dashboard, pedidos, catalogo, ...). NULL = defaults do role.';

CREATE INDEX IF NOT EXISTS perfis_role_idx ON public.perfis (role);
CREATE INDEX IF NOT EXISTS perfis_email_idx ON public.perfis (email);

-- Helper SECURITY DEFINER evita recursão de RLS
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

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION public.set_perfis_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perfis_set_updated_at ON public.perfis;
CREATE TRIGGER perfis_set_updated_at
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.set_perfis_updated_at();
