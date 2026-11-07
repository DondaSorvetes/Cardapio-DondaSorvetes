export interface EnderecoObject {
  id?: string;
  cep?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  numero?: string;
  apelido?: string;
  principal?: boolean;
  created_at?: string;
  logradouro?: string;
  complemento?: string;
}

export interface PedidoComplemento {
  id?: string;
  name: string;
  price: number;
  groupId?: string;
  groupName?: string;
}

export interface PedidoItem {
  id?: string;
  uid?: string;
  qty: number;
  total: number;
  observacoes?: string;
  /** "Deseja colher?": true/false; ausente = produto não pergunta (ou pedido antigo). */
  colher?: boolean;
  produto: {
    id: string;
    name: string;
    price: number;
    image?: string;
  };
  /** Mapa original grupoId → optionIds (como vem do carrinho) */
  selections?: Record<string, string[]> | PedidoComplemento[];
  /** Lista resolvida com nomes (preferencial para UI/impressão) */
  adicionais?: PedidoComplemento[];
  selectionsResolved?: PedidoComplemento[];
  complementos?: PedidoComplemento[] | Record<string, unknown> | string | null;
}

export interface Pedido {
  id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  tipo_entrega: "delivery" | "entrega" | "retirada";
  /** Retirada agendada: início da janela de 15 min. Null = retirar agora. */
  agendado_para?: string | null;
  endereco_completo?: string;
  meio_pagamento: string;
  /** Pode vir string do Postgres/JSONB; sempre normalize com Number() na UI */
  troco_para?: number | string | null;
  cupom_codigo?: string | null;
  desconto_cupom?: number | string | null;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  itens: PedidoItem[];
  status:
    | "pendente"
    | "confirmado"
    | "preparando"
    | "saiu_entrega"
    | "entregue"
    | "cancelado";
  observacoes?: string;
  /** Entregador que recebeu o pedido ao sair para entrega (migration 0019). */
  entregador_id?: string | null;
  /** Só no detalhe do cliente: primeiro nome de quem está levando o pedido. */
  entregador_nome?: string | null;
  saiu_entrega_at?: string | null;
  entregue_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type PedidoStatus = Pedido["status"];

export const statusConfig = {
  pendente: {
    label: "Novo",
    color: "bg-[#FDE6EE] text-[#C8285F] border-[#F6BFD2]",
    dot: "bg-[#C8285F]",
  },
  confirmado: {
    label: "Confirmado",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  preparando: {
    label: "Em preparo",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  saiu_entrega: {
    label: "Saiu para Entrega",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  entregue: {
    label: "Concluído",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  cancelado: {
    label: "Cancelado",
    color: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};
