/**
 * Preferências operacionais do estabelecimento.
 * Separadas das configurações técnicas do sistema.
 */

export type SomAlertaTipo = "classico" | "suave" | "urgente";

export interface PreferenciasEstabelecimento {
  id: number;
  /** Pedidos em aberto há +24h finalizados automaticamente */
  finalizar_pedidos_apos_24h: boolean;
  /** Pedidos agendados finalizados 3 dias após a data */
  finalizar_agendados_apos_3_dias: boolean;
  /** Aceita + imprime novos pedidos automaticamente */
  imprimir_aceitar_automaticamente: boolean;
  /** Alias operacional já existente no banco */
  aceitar_pedidos_automaticamente: boolean;
  /** Notificação visual de novos pedidos */
  notificar_novos_pedidos: boolean;
  /** Som de alerta ativo */
  som_alerta_ativo: boolean;
  som_alerta_tipo: SomAlertaTipo;
  /** 0–100 */
  som_alerta_volume: number;
  /** Próximo número da sequência de pedidos */
  proximo_numero_pedido: number;
}

export type PreferenciasEstabelecimentoUpdate = Partial<
  Omit<PreferenciasEstabelecimento, "id">
>;

export const SOM_ALERTA_OPCOES: {
  value: SomAlertaTipo;
  label: string;
  description: string;
}[] = [
  {
    value: "classico",
    label: "Clássico",
    description: "Dois bipes claros — padrão de delivery",
  },
  {
    value: "suave",
    label: "Suave",
    description: "Tom mais baixo e discreto",
  },
  {
    value: "urgente",
    label: "Urgente",
    description: "Alerta mais agudo e insistente",
  },
];

export const DEFAULT_PREFERENCIAS_ESTABELECIMENTO: PreferenciasEstabelecimento =
  {
    id: 0,
    finalizar_pedidos_apos_24h: false,
    finalizar_agendados_apos_3_dias: false,
    imprimir_aceitar_automaticamente: false,
    aceitar_pedidos_automaticamente: false,
    notificar_novos_pedidos: true,
    som_alerta_ativo: true,
    som_alerta_tipo: "classico",
    som_alerta_volume: 70,
    proximo_numero_pedido: 1,
  };

export function normalizePreferenciasEstabelecimento(
  raw: Record<string, unknown> | null | undefined
): PreferenciasEstabelecimento {
  if (!raw) return { ...DEFAULT_PREFERENCIAS_ESTABELECIMENTO };

  const tipo = String(raw.som_alerta_tipo ?? "classico");
  const somTipo: SomAlertaTipo =
    tipo === "suave" || tipo === "urgente" || tipo === "classico"
      ? tipo
      : "classico";

  const volumeRaw = Number(raw.som_alerta_volume ?? 70);
  const volume = Number.isFinite(volumeRaw)
    ? Math.min(100, Math.max(0, Math.round(volumeRaw)))
    : 70;

  const proximoRaw = Number(raw.proximo_numero_pedido ?? 1);
  const proximo = Number.isFinite(proximoRaw)
    ? Math.max(1, Math.floor(proximoRaw))
    : 1;

  return {
    id: Number(raw.id) || 0,
    finalizar_pedidos_apos_24h: Boolean(raw.finalizar_pedidos_apos_24h),
    finalizar_agendados_apos_3_dias: Boolean(
      raw.finalizar_agendados_apos_3_dias
    ),
    imprimir_aceitar_automaticamente: Boolean(
      raw.imprimir_aceitar_automaticamente
    ),
    aceitar_pedidos_automaticamente: Boolean(
      raw.aceitar_pedidos_automaticamente
    ),
    notificar_novos_pedidos:
      raw.notificar_novos_pedidos === undefined ||
      raw.notificar_novos_pedidos === null
        ? true
        : Boolean(raw.notificar_novos_pedidos),
    som_alerta_ativo:
      raw.som_alerta_ativo === undefined || raw.som_alerta_ativo === null
        ? true
        : Boolean(raw.som_alerta_ativo),
    som_alerta_tipo: somTipo,
    som_alerta_volume: volume,
    proximo_numero_pedido: proximo,
  };
}
