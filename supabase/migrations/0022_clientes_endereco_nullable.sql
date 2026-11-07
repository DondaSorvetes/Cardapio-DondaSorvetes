-- Cadastro sem endereço: a coluna legada clientes.endereco não deve ser obrigatória
-- (os endereços estruturados ficam em enderecos_adicionais).
ALTER TABLE public.clientes ALTER COLUMN endereco DROP NOT NULL;
