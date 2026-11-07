export interface ClienteEndereco {
  id: string;
  cep: string;
  bairro: string;
  cidade: string;
  estado: string;
  numero: string;
  apelido?: string;
  principal: boolean;
  created_at: string;
  logradouro: string;
  complemento?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  created_at: string;
  endereco?: string; // Endereço principal como string
  enderecos_adicionais?: ClienteEndereco[];
  // Estatísticas calculadas
  total_pedidos?: number;
  total_gasto?: number;
  ultimo_pedido?: string;
  ticket_medio?: number;
  status_cliente?: "novo" | "frequente" | "vip" | "inativo";
}

export const clienteStatusConfig = {
  novo: {
    label: "Novo",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  frequente: {
    label: "Frequente",
    color: "bg-[#FDE6EE] text-[#C8285F] border-[#C8285F]",
  },
  vip: {
    label: "VIP",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  inativo: {
    label: "Inativo",
    color: "bg-gray-50 text-gray-700 border-gray-200",
  },
};
