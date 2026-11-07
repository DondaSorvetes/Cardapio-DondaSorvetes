-- Preferências operacionais do estabelecimento (Configurações do Estabelecimento)
-- Colunas opcionais / com default seguro para não quebrar ambientes existentes.

ALTER TABLE configuracoes_loja
  ADD COLUMN IF NOT EXISTS finalizar_pedidos_apos_24h boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalizar_agendados_apos_3_dias boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS imprimir_aceitar_automaticamente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificar_novos_pedidos boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS som_alerta_ativo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS som_alerta_tipo text DEFAULT 'classico',
  ADD COLUMN IF NOT EXISTS som_alerta_volume integer DEFAULT 70,
  ADD COLUMN IF NOT EXISTS proximo_numero_pedido integer DEFAULT 1;

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
