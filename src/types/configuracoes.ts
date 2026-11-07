export interface ConfiguracaoLoja {
  id: string | number;
  nome: string;
  descricao?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  horario_abertura?: string | null;
  horario_fechamento?: string | null;
  /** No formulário admin: array. No banco: string serializada. */
  dias_funcionamento?: string[] | string | null;
  taxa_entrega?: number | null;
  pedido_minimo?: number | null;
  tempo_entrega_min?: number | null;
  tempo_entrega_max?: number | null;
  esta_aberto: boolean;
  /** Novos pedidos entram direto em preparo quando true */
  aceitar_pedidos_automaticamente?: boolean;
  /** Recebendo pedidos (pode pausar sem fechar a loja) */
  aceitando_pedidos?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AlteracaoHistorico {
  id: string;
  campo: string;
  valor_anterior?: string;
  valor_novo: string;
  created_at: string;
  admin_id?: string;
}

export const diasSemana = [
  { value: "segunda", label: "Segunda-feira" },
  { value: "terca", label: "Terça-feira" },
  { value: "quarta", label: "Quarta-feira" },
  { value: "quinta", label: "Quinta-feira" },
  { value: "sexta", label: "Sexta-feira" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

export const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function parseDiasFuncionamento(
  value: string | string[] | null | undefined
): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  const trimmed = String(value).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through
    }
  }
  return trimmed
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

export function formatDiasFuncionamentoLabel(
  value: string | string[] | null | undefined
): string {
  const dias = parseDiasFuncionamento(value);
  if (dias.length === 0) return "";
  if (dias.length === 7) return "Todos os dias";

  const labels = diasSemana
    .filter((d) => dias.includes(d.value))
    .map((d) => d.label);

  if (labels.length === 0) return dias.join(", ");
  if (labels.length <= 3) return labels.join(", ");
  return `${labels[0]} a ${labels[labels.length - 1]}`;
}

export function normalizeConfiguracao(
  raw: Record<string, unknown> | ConfiguracaoLoja
): ConfiguracaoLoja {
  const r = raw as Record<string, unknown>;
  return {
    id: (r.id as string | number) ?? 0,
    nome: String(r.nome ?? "Sorvetes Donda"),
    descricao: (r.descricao as string | null) ?? null,
    logo_url: (r.logo_url as string | null) ?? null,
    banner_url: (r.banner_url as string | null) ?? null,
    endereco: (r.endereco as string | null) ?? null,
    cidade: (r.cidade as string | null) ?? null,
    estado: (r.estado as string | null) ?? null,
    telefone: (r.telefone as string | null) ?? null,
    whatsapp: (r.whatsapp as string | null) ?? null,
    instagram: (r.instagram as string | null) ?? null,
    facebook: (r.facebook as string | null) ?? null,
    horario_abertura: (r.horario_abertura as string | null) ?? null,
    horario_fechamento: (r.horario_fechamento as string | null) ?? null,
    dias_funcionamento: parseDiasFuncionamento(
      r.dias_funcionamento as string | string[] | null
    ),
    taxa_entrega:
      r.taxa_entrega == null ? null : Number(r.taxa_entrega),
    pedido_minimo:
      r.pedido_minimo == null ? null : Number(r.pedido_minimo),
    tempo_entrega_min:
      r.tempo_entrega_min == null ? null : Number(r.tempo_entrega_min),
    tempo_entrega_max:
      r.tempo_entrega_max == null ? null : Number(r.tempo_entrega_max),
    esta_aberto: Boolean(r.esta_aberto),
    aceitar_pedidos_automaticamente: Boolean(
      r.aceitar_pedidos_automaticamente
    ),
    aceitando_pedidos:
      r.aceitando_pedidos === undefined || r.aceitando_pedidos === null
        ? Boolean(r.esta_aberto)
        : Boolean(r.aceitando_pedidos),
    created_at: r.created_at as string | undefined,
    updated_at: r.updated_at as string | undefined,
  };
}
