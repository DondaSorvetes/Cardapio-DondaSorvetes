-- Existing combos retain their original closed composition.
ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS opcoes_config jsonb;
ALTER TABLE public.combos ADD CONSTRAINT combos_opcoes_config_valid CHECK (
  opcoes_config IS NULL OR (
    jsonb_typeof(opcoes_config) = 'object'
    AND opcoes_config ? 'modo'
    AND opcoes_config ? 'selecoes'
    AND jsonb_typeof(opcoes_config->'modo') = 'string'
    AND opcoes_config->>'modo' IN ('cliente', 'fixo')
    AND jsonb_typeof(opcoes_config->'selecoes') = 'object'
  )
);
NOTIFY pgrst, 'reload schema';
