-- Cupons de desconto e combos compostos por produtos existentes.
CREATE TABLE IF NOT EXISTS public.cupons (
  id serial PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('percentual', 'valor_fixo')),
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  valor_minimo numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_minimo >= 0),
  limite_usos integer CHECK (limite_usos IS NULL OR limite_usos > 0),
  usos integer NOT NULL DEFAULT 0 CHECK (usos >= 0),
  data_inicio date NOT NULL DEFAULT (timezone('America/Sao_Paulo', now())::date),
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cupons_periodo_valido CHECK (data_fim IS NULL OR data_fim >= data_inicio),
  CONSTRAINT cupons_percentual_valido CHECK (tipo <> 'percentual' OR valor <= 100)
);

CREATE TABLE IF NOT EXISTS public.combos (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL CHECK (preco > 0),
  imagem_url text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.combo_itens (
  combo_id integer NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  produto_id integer NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  PRIMARY KEY (combo_id, produto_id)
);

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cupom_codigo text,
  ADD COLUMN IF NOT EXISTS desconto_cupom numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS combos_select_public ON public.combos;
CREATE POLICY combos_select_public ON public.combos
  FOR SELECT TO anon, authenticated USING (ativa = true);

DROP POLICY IF EXISTS combo_itens_select_public ON public.combo_itens;
CREATE POLICY combo_itens_select_public ON public.combo_itens
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.combos c WHERE c.id = combo_id AND c.ativa = true)
  );

CREATE INDEX IF NOT EXISTS combo_itens_produto_idx ON public.combo_itens (produto_id);

CREATE OR REPLACE FUNCTION public.aplicar_cupom_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cupom public.cupons%ROWTYPE;
  desconto numeric(10,2) := 0;
  hoje date := timezone('America/Sao_Paulo', now())::date;
BEGIN
  IF NEW.cupom_codigo IS NULL OR btrim(NEW.cupom_codigo) = '' THEN
    NEW.cupom_codigo := NULL;
    NEW.desconto_cupom := 0;
    NEW.total := NEW.subtotal + COALESCE(NEW.taxa_entrega, 0);
    RETURN NEW;
  END IF;

  SELECT * INTO cupom
    FROM public.cupons
    WHERE codigo = upper(btrim(NEW.cupom_codigo))
    FOR UPDATE;

  IF NOT FOUND OR NOT cupom.ativo THEN
    RAISE EXCEPTION 'CUPOM_INVALIDO';
  END IF;
  IF hoje < cupom.data_inicio OR (cupom.data_fim IS NOT NULL AND hoje > cupom.data_fim) THEN
    RAISE EXCEPTION 'CUPOM_FORA_DA_VALIDADE';
  END IF;
  IF cupom.limite_usos IS NOT NULL AND cupom.usos >= cupom.limite_usos THEN
    RAISE EXCEPTION 'CUPOM_ESGOTADO';
  END IF;
  IF NEW.subtotal < cupom.valor_minimo THEN
    RAISE EXCEPTION 'CUPOM_VALOR_MINIMO';
  END IF;

  IF cupom.tipo = 'percentual' THEN
    desconto := round(NEW.subtotal * cupom.valor / 100, 2);
  ELSE
    desconto := cupom.valor;
  END IF;
  desconto := LEAST(NEW.subtotal, desconto);

  UPDATE public.cupons SET usos = usos + 1 WHERE id = cupom.id;
  NEW.cupom_codigo := cupom.codigo;
  NEW.desconto_cupom := desconto;
  NEW.total := NEW.subtotal + COALESCE(NEW.taxa_entrega, 0) - desconto;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_aplicar_cupom ON public.pedidos;
CREATE TRIGGER pedidos_aplicar_cupom
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_cupom_pedido();
