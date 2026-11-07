-- Acrescenta horário às campanhas de frete já existentes.
ALTER TABLE public.promocoes_frete_gratis
  ADD COLUMN IF NOT EXISTS hora_inicio time NOT NULL DEFAULT '00:00';

ALTER TABLE public.promocoes_frete_gratis
  ADD COLUMN IF NOT EXISTS hora_fim time NOT NULL DEFAULT '23:59';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promocoes_frete_datetime_valido'
      AND conrelid = 'public.promocoes_frete_gratis'::regclass
  ) THEN
    ALTER TABLE public.promocoes_frete_gratis
      ADD CONSTRAINT promocoes_frete_datetime_valido
      CHECK (data_fim > data_inicio OR (data_fim = data_inicio AND hora_fim >= hora_inicio));
  END IF;
END $$;
