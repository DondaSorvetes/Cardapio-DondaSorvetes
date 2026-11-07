export type RelatorioPeriodoPreset =
  | "hoje"
  | "ontem"
  | "7d"
  | "30d"
  | "90d"
  | "mes"
  | "mes_passado"
  | "custom";

export type RelatorioFiltros = {
  preset: RelatorioPeriodoPreset;
  from?: string; // ISO
  to?: string; // ISO
  status?: string | "todos";
  meio_pagamento?: string | "todos";
  tipo_entrega?: string | "todos";
  cliente?: string;
  produto?: string;
  cidade?: string;
  bairro?: string;
};

export type KpiCard = {
  key: string;
  label: string;
  value: string;
  subtitle?: string;
  trend?: number | null;
  comparisonBase?: number;
  trendLabel?: string;
  variant: "purple" | "blue" | "green" | "orange" | "pink" | "red";
  icon:
    | "DollarSign"
    | "ShoppingBag"
    | "Users"
    | "Target"
    | "XCircle"
    | "CheckCircle2"
    | "Clock"
    | "Bike";
};

export type SerieDia = {
  date: string; // yyyy-MM-dd
  label: string;
  faturamento: number;
  faturamentoAnterior: number;
  pedidos: number;
};

export type NomeValor = {
  name: string;
  value: number;
  percent?: number;
  extra?: string | number;
};

export type ProdutoRank = {
  nome: string;
  quantidade: number;
  faturamento: number;
  participacao: number;
};

export type ClienteRank = {
  nome: string;
  telefone?: string;
  pedidos: number;
  totalGasto: number;
  ticketMedio: number;
  ultimaCompra: string;
};

export type SerieHora = { hora: string; pedidos: number };
export type SerieSemana = { dia: string; pedidos: number; faturamento: number };
export type SerieMes = { mes: string; faturamento: number; pedidos: number };

export type Comparativo = {
  label: string;
  atual: number;
  anterior: number;
  deltaPct: number | null;
  format: "currency" | "number";
};

export type RelatorioFinanceiro = {
  faturamentoBruto: number;
  descontos: number;
  taxaEntrega: number;
  totalLiquido: number;
  pagamentoMaisUsado: string;
};

export type RelatorioPedidoLinha = {
  id: string;
  cliente: string;
  data: string;
  status: string;
  pagamento: string;
  total: number;
};

export type RelatorioDestaques = {
  maiorVenda: number;
  menorVenda: number;
  horarioPico: string;
  diaMaisPedidos: string;
  produtoCampeao: string;
  clienteTop: string;
};

export type RelatorioEmpresa = {
  nome: string;
  logoUrl?: string | null;
};

export type RelatorioData = {
  range: { from: string; to: string; label: string };
  prevRange: { from: string; to: string };
  kpis: KpiCard[];
  faturamentoDiario: SerieDia[];
  pedidosDiarios: SerieDia[];
  pagamentos: NomeValor[];
  status: NomeValor[];
  produtos: ProdutoRank[];
  sabores: ProdutoRank[];
  tamanhos: NomeValor[];
  adicionais: ProdutoRank[];
  clientes: ClienteRank[];
  porHora: SerieHora[];
  porDiaSemana: SerieSemana[];
  receitaMensal: SerieMes[];
  comparativos: Comparativo[];
  entregaVsRetirada: NomeValor[];
  tempoMedioMinutos: number | null;
  totalPedidosPeriodo: number;
  cidades: string[];
  bairros: string[];
  meiosPagamento: string[];
  produtosDisponiveis: string[];
  /** Dados extras para PDF gerencial */
  financeiro: RelatorioFinanceiro;
  pedidosLista: RelatorioPedidoLinha[];
  destaques: RelatorioDestaques;
  empresa: RelatorioEmpresa;
  observacoes: string | null;
};
