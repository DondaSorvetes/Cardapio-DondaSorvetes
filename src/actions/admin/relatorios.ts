"use server";

import {
  startOfDay,
  endOfDay,
  subDays,
  subYears,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  format,
  eachDayOfInterval,
  differenceInMinutes,
  parseISO,
  isValid,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import type {
  RelatorioData,
  RelatorioFiltros,
  RelatorioPeriodoPreset,
  ProdutoRank,
  ClienteRank,
  SerieDia,
  NomeValor,
  Comparativo,
} from "@/types/relatorios";

type PedidoRow = {
  id: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  tipo_entrega: string;
  endereco_completo: string | Record<string, unknown> | null;
  meio_pagamento: string;
  subtotal: number | string;
  taxa_entrega: number | string;
  total: number | string;
  itens: unknown;
  status: string;
  created_at: string;
  updated_at: string;
};

const CANCELADO = "cancelado";
const PAGO_STATUSES = new Set([
  "pendente",
  "preparando",
  "saiu_entrega",
  "entregue",
]);

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pctDelta(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : 100;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

function resolveRange(filtros: RelatorioFiltros): {
  from: Date;
  to: Date;
  label: string;
  preset: RelatorioPeriodoPreset;
} {
  const now = new Date();
  const preset = filtros.preset || "30d";

  if (preset === "custom" && filtros.from && filtros.to) {
    const from = startOfDay(parseISO(filtros.from));
    const to = endOfDay(parseISO(filtros.to));
    if (isValid(from) && isValid(to) && from <= to) {
      return {
        from,
        to,
        preset,
        label: `${format(from, "dd/MM/yyyy")} – ${format(to, "dd/MM/yyyy")}`,
      };
    }
  }

  switch (preset) {
    case "hoje":
      return {
        from: startOfDay(now),
        to: endOfDay(now),
        preset: "hoje",
        label: "Hoje",
      };
    case "ontem": {
      const d = subDays(now, 1);
      return {
        from: startOfDay(d),
        to: endOfDay(d),
        preset: "ontem",
        label: "Ontem",
      };
    }
    case "7d":
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
        preset: "7d",
        label: "Últimos 7 dias",
      };
    case "90d":
      return {
        from: startOfDay(subDays(now, 89)),
        to: endOfDay(now),
        preset: "90d",
        label: "Últimos 90 dias",
      };
    case "mes":
      return {
        from: startOfMonth(now),
        to: endOfDay(now),
        preset: "mes",
        label: "Este mês",
      };
    case "mes_passado": {
      const m = subMonths(now, 1);
      return {
        from: startOfMonth(m),
        to: endOfMonth(m),
        preset: "mes_passado",
        label: "Mês passado",
      };
    }
    case "30d":
    default:
      return {
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
        preset: "30d",
        label: "Últimos 30 dias",
      };
  }
}

function previousRange(from: Date, to: Date) {
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom, to: prevTo };
}

function getCidade(endereco: string | Record<string, unknown> | null): string {
  if (!endereco) return "";
  if (typeof endereco === "string") return "";
  return String(endereco.cidade || "").trim();
}

function getBairro(endereco: string | Record<string, unknown> | null): string {
  if (!endereco) return "";
  if (typeof endereco === "string") return "";
  return String(endereco.bairro || "").trim();
}

function matchesFilters(p: PedidoRow, f: RelatorioFiltros): boolean {
  if (f.status && f.status !== "todos" && p.status !== f.status) return false;
  if (
    f.meio_pagamento &&
    f.meio_pagamento !== "todos" &&
    p.meio_pagamento?.toLowerCase() !== f.meio_pagamento.toLowerCase()
  )
    return false;
  if (f.tipo_entrega && f.tipo_entrega !== "todos") {
    const t = p.tipo_entrega?.toLowerCase() || "";
    const want = f.tipo_entrega.toLowerCase();
    if (want === "entrega" || want === "delivery") {
      if (t !== "entrega" && t !== "delivery") return false;
    } else if (t !== want) return false;
  }
  if (f.cliente) {
    const q = f.cliente.toLowerCase();
    if (
      !p.cliente_nome?.toLowerCase().includes(q) &&
      !(p.cliente_telefone || "").includes(q)
    )
      return false;
  }
  if (f.cidade) {
    if (
      getCidade(p.endereco_completo).toLowerCase() !== f.cidade.toLowerCase()
    )
      return false;
  }
  if (f.bairro) {
    if (
      getBairro(p.endereco_completo).toLowerCase() !== f.bairro.toLowerCase()
    )
      return false;
  }
  if (f.produto) {
    const q = f.produto.toLowerCase();
    const itens = Array.isArray(p.itens) ? p.itens : [];
    const hit = itens.some((raw) => {
      const i = raw as { produto?: { name?: string; nome?: string } };
      return String(i?.produto?.name || i?.produto?.nome || "")
        .toLowerCase()
        .includes(q);
    });
    if (!hit) return false;
  }
  return true;
}

type ItemExtra = {
  name: string;
  price: number;
  groupName?: string;
};

type ItemLike = {
  qty?: number | string;
  total?: number | string;
  produto?: { name?: string; nome?: string; price?: number | string };
  adicionais?: unknown;
  selectionsResolved?: unknown;
  selections?: unknown;
};

function getAdicionais(item: ItemLike): ItemExtra[] {
  const list =
    item?.adicionais ||
    item?.selectionsResolved ||
    (Array.isArray(item?.selections) ? item.selections : null);
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const a = raw as Record<string, unknown>;
      return {
        name: String(a?.name || a?.nome || "").trim(),
        price: num(a?.price ?? a?.preco ?? 0),
        groupName: String(a?.groupName || a?.group_name || a?.grupo || "").trim(),
      };
    })
    .filter((a) => a.name);
}

function classifyExtra(a: ItemExtra): "sabor" | "tamanho" | "adicional" {
  const g = (a.groupName || "").toLowerCase();
  const n = a.name.toLowerCase();
  if (
    g.includes("tamanho") ||
    g.includes("volume") ||
    /\d+\s*ml/.test(n) ||
    /\d+\s*l\b/.test(n)
  )
    return "tamanho";
  if (g.includes("sabor")) return "sabor";
  return "adicional";
}

function rankMapToList(
  map: Map<string, { qty: number; revenue: number }>,
  totalRevenue: number,
  limit = 10
): ProdutoRank[] {
  return Array.from(map.entries())
    .map(([nome, v]) => ({
      nome,
      quantidade: v.qty,
      faturamento: v.revenue,
      participacao:
        totalRevenue > 0
          ? Number(((v.revenue / totalRevenue) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento)
    .slice(0, limit);
}

function bump(
  map: Map<string, { qty: number; revenue: number }>,
  key: string,
  qty: number,
  revenue: number
) {
  if (!key) return;
  const cur = map.get(key) || { qty: 0, revenue: 0 };
  cur.qty += qty;
  cur.revenue += revenue;
  map.set(key, cur);
}

async function fetchPedidosBetween(from: Date, to: Date): Promise<PedidoRow[]> {
  const supabase = createServiceRoleClient();
  const pageSize = 1000;
  let fromIdx = 0;
  const all: PedidoRow[] = [];

  // Paginação server-side — só colunas necessárias
  while (true) {
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id,cliente_id,cliente_nome,cliente_telefone,tipo_entrega,endereco_completo,meio_pagamento,subtotal,taxa_entrega,total,itens,status,created_at,updated_at"
      )
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: true })
      .range(fromIdx, fromIdx + pageSize - 1);

    if (error) {
      console.error("[relatorios] erro fetch:", error);
      throw new Error("Não foi possível carregar os pedidos para o relatório");
    }

    const batch = (data || []) as PedidoRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    fromIdx += pageSize;
    // proteção
    if (fromIdx > 50000) break;
  }

  return all;
}

function aggregatePeriod(
  rows: PedidoRow[],
  from: Date,
  to: Date
): {
  faturamento: number;
  pedidos: number;
  cancelados: number;
  pagos: number;
  clientes: Set<string>;
  ticketMedio: number;
  byDay: Map<string, { fat: number; ped: number }>;
  byHour: number[];
  byWeekday: { ped: number; fat: number }[];
  pagamentos: Map<string, number>;
  status: Map<string, number>;
  produtos: Map<string, { qty: number; revenue: number }>;
  sabores: Map<string, { qty: number; revenue: number }>;
  tamanhos: Map<string, number>;
  adicionais: Map<string, { qty: number; revenue: number }>;
  clientesMap: Map<string, ClienteRank>;
  entrega: number;
  retirada: number;
  tempos: number[];
  cidades: Set<string>;
  bairros: Set<string>;
  meios: Set<string>;
  produtosSet: Set<string>;
  taxaEntregaTotal: number;
  totaisValidos: number[];
} {
  const byDay = new Map<string, { fat: number; ped: number }>();
  for (const d of eachDayOfInterval({ start: from, end: to })) {
    byDay.set(format(d, "yyyy-MM-dd"), { fat: 0, ped: 0 });
  }

  const byHour = Array.from({ length: 24 }, () => 0);
  const byWeekday = Array.from({ length: 7 }, () => ({ ped: 0, fat: 0 }));
  const pagamentos = new Map<string, number>();
  const status = new Map<string, number>();
  const produtos = new Map<string, { qty: number; revenue: number }>();
  const sabores = new Map<string, { qty: number; revenue: number }>();
  const tamanhos = new Map<string, number>();
  const adicionais = new Map<string, { qty: number; revenue: number }>();
  const clientesMap = new Map<string, ClienteRank>();
  const clientes = new Set<string>();
  const cidades = new Set<string>();
  const bairros = new Set<string>();
  const meios = new Set<string>();
  const produtosSet = new Set<string>();
  const tempos: number[] = [];

  let faturamento = 0;
  let pedidos = 0;
  let cancelados = 0;
  let pagos = 0;
  let entrega = 0;
  let retirada = 0;
  let taxaEntregaTotal = 0;
  const totaisValidos: number[] = [];

  for (const p of rows) {
    const total = num(p.total);
    const dayKey = format(new Date(p.created_at), "yyyy-MM-dd");
    const hour = new Date(p.created_at).getHours();
    // getDay: 0=Dom → remap para Seg=0
    const jsDay = new Date(p.created_at).getDay();
    const weekday = jsDay === 0 ? 6 : jsDay - 1;

    status.set(p.status, (status.get(p.status) || 0) + 1);
    if (p.meio_pagamento) {
      meios.add(p.meio_pagamento);
      pagamentos.set(
        p.meio_pagamento,
        (pagamentos.get(p.meio_pagamento) || 0) + 1
      );
    }

    const cidade = getCidade(p.endereco_completo);
    const bairro = getBairro(p.endereco_completo);
    if (cidade) cidades.add(cidade);
    if (bairro) bairros.add(bairro);

    const t = (p.tipo_entrega || "").toLowerCase();
    if (t === "entrega" || t === "delivery") entrega++;
    else retirada++;

    byHour[hour] = (byHour[hour] || 0) + 1;

    if (p.status === CANCELADO) {
      cancelados++;
      continue;
    }

    pedidos++;
    faturamento += total;
    taxaEntregaTotal += num(p.taxa_entrega);
    totaisValidos.push(total);
    if (PAGO_STATUSES.has(p.status)) pagos++;

    const day = byDay.get(dayKey);
    if (day) {
      day.fat += total;
      day.ped += 1;
    }

    byWeekday[weekday].ped += 1;
    byWeekday[weekday].fat += total;

    const clienteKey =
      p.cliente_id || p.cliente_telefone || p.cliente_nome || p.id;
    clientes.add(clienteKey);
    const existing = clientesMap.get(clienteKey);
    if (existing) {
      existing.pedidos += 1;
      existing.totalGasto += total;
      existing.ticketMedio = existing.totalGasto / existing.pedidos;
      if (p.created_at > existing.ultimaCompra) {
        existing.ultimaCompra = p.created_at;
      }
    } else {
      clientesMap.set(clienteKey, {
        nome: p.cliente_nome || "Cliente",
        telefone: p.cliente_telefone || undefined,
        pedidos: 1,
        totalGasto: total,
        ticketMedio: total,
        ultimaCompra: p.created_at,
      });
    }

    if (p.updated_at && p.created_at && p.status === "entregue") {
      const mins = differenceInMinutes(
        new Date(p.updated_at),
        new Date(p.created_at)
      );
      if (mins >= 0 && mins < 24 * 60) tempos.push(mins);
    }

    const itens = Array.isArray(p.itens) ? (p.itens as ItemLike[]) : [];
    for (const item of itens) {
      const nome = String(item?.produto?.name || item?.produto?.nome || "").trim();
      const qty = num(item?.qty || 1);
      const itemTotal = num(item?.total ?? item?.produto?.price ?? 0);
      if (nome) {
        produtosSet.add(nome);
        bump(produtos, nome, qty, itemTotal);
      }

      for (const extra of getAdicionais(item)) {
        const kind = classifyExtra(extra);
        if (kind === "sabor") {
          bump(sabores, extra.name, qty, extra.price * qty);
        } else if (kind === "tamanho") {
          tamanhos.set(extra.name, (tamanhos.get(extra.name) || 0) + qty);
        } else {
          bump(adicionais, extra.name, qty, extra.price * qty);
        }
      }
    }
  }

  return {
    faturamento,
    pedidos,
    cancelados,
    pagos,
    clientes,
    ticketMedio: pedidos > 0 ? faturamento / pedidos : 0,
    byDay,
    byHour,
    byWeekday,
    pagamentos,
    status,
    produtos,
    sabores,
    tamanhos,
    adicionais,
    clientesMap,
    entrega,
    retirada,
    tempos,
    cidades,
    bairros,
    meios,
    produtosSet,
    taxaEntregaTotal,
    totaisValidos,
  };
}

function mapStatusLabel(s: string): string {
  const map: Record<string, string> = {
    pendente: "Recebido",
    preparando: "Em preparo",
    saiu_entrega: "Saiu para entrega",
    entregue: "Finalizado",
    cancelado: "Cancelado",
  };
  return map[s] || s;
}

function mapPayLabel(s: string): string {
  const map: Record<string, string> = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cartao: "Cartão",
    "cartão": "Cartão",
    "cartão de crédito": "Cartão de crédito",
    "cartão de débito": "Cartão de débito",
    credito: "Cartão de crédito",
    debito: "Cartão de débito",
  };
  return map[s?.toLowerCase()] || s;
}

export async function getRelatorios(
  filtros: RelatorioFiltros
): Promise<RelatorioData> {
  await requirePermission("relatorio:read");

  const { from, to, label } = resolveRange(filtros);
  const prev = previousRange(from, to);

  const supabase = createServiceRoleClient();

  // Busca atual + anterior + ano + dados da loja em paralelo
  const [rowsAtualRaw, rowsPrevRaw, rowsYear, lojaRes] = await Promise.all([
    fetchPedidosBetween(from, to),
    fetchPedidosBetween(prev.from, prev.to),
    fetchPedidosBetween(startOfDay(subDays(new Date(), 364)), endOfDay(new Date())),
    supabase
      .from("configuracoes_loja")
      .select("nome, logo_url")
      .limit(1)
      .maybeSingle(),
  ]);

  const rowsAtual = rowsAtualRaw.filter((p) => matchesFilters(p, filtros));
  const rowsPrev = rowsPrevRaw.filter((p) => matchesFilters(p, filtros));

  const atual = aggregatePeriod(rowsAtual, from, to);
  const anterior = aggregatePeriod(rowsPrev, prev.from, prev.to);

  // Séries diárias
  const faturamentoDiario: SerieDia[] = [];
  const pedidosDiarios: SerieDia[] = [];
  const days = eachDayOfInterval({ start: from, end: to });
  const prevDays = eachDayOfInterval({ start: prev.from, end: prev.to });

  days.forEach((d, i) => {
    const key = format(d, "yyyy-MM-dd");
    const cur = atual.byDay.get(key) || { fat: 0, ped: 0 };
    const prevKey = prevDays[i]
      ? format(prevDays[i], "yyyy-MM-dd")
      : null;
    const prevVal = prevKey
      ? anterior.byDay.get(prevKey) || { fat: 0, ped: 0 }
      : { fat: 0, ped: 0 };

    const labelDay = format(d, days.length <= 14 ? "dd/MM" : "dd/MM", {
      locale: ptBR,
    });

    faturamentoDiario.push({
      date: key,
      label: labelDay,
      faturamento: Number(cur.fat.toFixed(2)),
      faturamentoAnterior: Number(prevVal.fat.toFixed(2)),
      pedidos: cur.ped,
    });
    pedidosDiarios.push({
      date: key,
      label: labelDay,
      faturamento: Number(cur.fat.toFixed(2)),
      faturamentoAnterior: Number(prevVal.fat.toFixed(2)),
      pedidos: cur.ped,
    });
  });

  const totalPedidos = rowsAtual.length;
  const cancelPct =
    totalPedidos > 0
      ? Number(((atual.cancelados / totalPedidos) * 100).toFixed(1))
      : 0;
  const pagosPct =
    totalPedidos > 0
      ? Number(((atual.pagos / totalPedidos) * 100).toFixed(1))
      : 0;

  const tempoMedioMinutos =
    atual.tempos.length > 0
      ? Math.round(
          atual.tempos.reduce((a, b) => a + b, 0) / atual.tempos.length
        )
      : null;

  const payTotal = Array.from(atual.pagamentos.values()).reduce(
    (a, b) => a + b,
    0
  );
  const pagamentos: NomeValor[] = Array.from(atual.pagamentos.entries())
    .map(([name, value]) => ({
      name: mapPayLabel(name),
      value,
      percent:
        payTotal > 0 ? Number(((value / payTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const statusTotal = Array.from(atual.status.values()).reduce(
    (a, b) => a + b,
    0
  );
  const status: NomeValor[] = Array.from(atual.status.entries())
    .map(([name, value]) => ({
      name: mapStatusLabel(name),
      value,
      percent:
        statusTotal > 0 ? Number(((value / statusTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const produtos = rankMapToList(atual.produtos, atual.faturamento, 15);
  const sabores = rankMapToList(atual.sabores, atual.faturamento, 15);
  const adicionais = rankMapToList(atual.adicionais, atual.faturamento, 15);

  const tamTotal = Array.from(atual.tamanhos.values()).reduce(
    (a, b) => a + b,
    0
  );
  const tamanhos: NomeValor[] = Array.from(atual.tamanhos.entries())
    .map(([name, value]) => ({
      name,
      value,
      percent:
        tamTotal > 0 ? Number(((value / tamTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const clientes = Array.from(atual.clientesMap.values())
    .sort((a, b) => b.totalGasto - a.totalGasto)
    .slice(0, 20);

  const porHora = atual.byHour.map((pedidos, h) => ({
    hora: `${String(h).padStart(2, "0")}h`,
    pedidos,
  }));

  const weekdayLabels = [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
  ];
  const porDiaSemana = atual.byWeekday.map((v, i) => ({
    dia: weekdayLabels[i],
    pedidos: v.ped,
    faturamento: Number(v.fat.toFixed(2)),
  }));

  // Receita mensal últimos 12 meses (a partir de rowsYear)
  const monthMap = new Map<string, { fat: number; ped: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    monthMap.set(format(d, "yyyy-MM"), { fat: 0, ped: 0 });
  }
  for (const p of rowsYear) {
    if (p.status === CANCELADO) continue;
    if (!matchesFilters(p, { ...filtros, preset: "custom" })) continue;
    const key = format(new Date(p.created_at), "yyyy-MM");
    const cur = monthMap.get(key);
    if (cur) {
      cur.fat += num(p.total);
      cur.ped += 1;
    }
  }
  const receitaMensal = Array.from(monthMap.entries()).map(([ym, v]) => {
    const [y, m] = ym.split("-");
    const date = new Date(Number(y), Number(m) - 1, 1);
    return {
      mes: format(date, "MMM/yy", { locale: ptBR }),
      faturamento: Number(v.fat.toFixed(2)),
      pedidos: v.ped,
    };
  });

  // Comparativos (sempre calculados com dados frescos do range natural)
  const now = new Date();
  const [
    hojeRows,
    ontemRows,
    semanaRows,
    semanaPassadaRows,
    mesRows,
    mesPassadoRows,
    anoRows,
    anoPassadoRows,
  ] = await Promise.all([
    fetchPedidosBetween(startOfDay(now), endOfDay(now)),
    fetchPedidosBetween(
      startOfDay(subDays(now, 1)),
      endOfDay(subDays(now, 1))
    ),
    fetchPedidosBetween(
      startOfWeek(now, { weekStartsOn: 1 }),
      endOfDay(now)
    ),
    fetchPedidosBetween(
      startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
      endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    ),
    fetchPedidosBetween(startOfMonth(now), endOfDay(now)),
    fetchPedidosBetween(
      startOfMonth(subMonths(now, 1)),
      endOfMonth(subMonths(now, 1))
    ),
    fetchPedidosBetween(startOfYear(now), endOfDay(now)),
    fetchPedidosBetween(
      startOfYear(subYears(now, 1)),
      endOfYear(subYears(now, 1))
    ),
  ]);

  const fat = (rows: PedidoRow[]) =>
    rows
      .filter((p) => p.status !== CANCELADO)
      .reduce((s, p) => s + num(p.total), 0);

  const buildComp = (
    labelComp: string,
    a: number,
    b: number
  ): Comparativo => ({
    label: labelComp,
    atual: a,
    anterior: b,
    deltaPct: pctDelta(a, b),
    format: "currency",
  });

  const comparativos: Comparativo[] = [
    buildComp("Hoje x Ontem", fat(hojeRows), fat(ontemRows)),
    buildComp(
      "Esta semana x Semana passada",
      fat(semanaRows),
      fat(semanaPassadaRows)
    ),
    buildComp("Este mês x Mês passado", fat(mesRows), fat(mesPassadoRows)),
    buildComp("Este ano x Ano passado", fat(anoRows), fat(anoPassadoRows)),
  ];

  const entregaTotal = atual.entrega + atual.retirada;
  const entregaVsRetirada: NomeValor[] = [
    {
      name: "Entrega",
      value: atual.entrega,
      percent:
        entregaTotal > 0
          ? Number(((atual.entrega / entregaTotal) * 100).toFixed(1))
          : 0,
    },
    {
      name: "Retirada",
      value: atual.retirada,
      percent:
        entregaTotal > 0
          ? Number(((atual.retirada / entregaTotal) * 100).toFixed(1))
          : 0,
    },
  ];

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      label,
    },
    prevRange: {
      from: prev.from.toISOString(),
      to: prev.to.toISOString(),
    },
    kpis: [
      {
        key: "faturamento",
        label: "Faturamento",
        value: money(atual.faturamento),
        trend: pctDelta(atual.faturamento, anterior.faturamento),
        comparisonBase: anterior.faturamento,
        trendLabel: "vs período anterior",
        variant: "purple",
        icon: "DollarSign",
      },
      {
        key: "pedidos",
        label: "Pedidos",
        value: String(atual.pedidos),
        subtitle: `${atual.pedidos} pedidos válidos`,
        trend: pctDelta(atual.pedidos, anterior.pedidos),
        comparisonBase: anterior.pedidos,
        trendLabel: "vs período anterior",
        variant: "blue",
        icon: "ShoppingBag",
      },
      {
        key: "ticket",
        label: "Ticket Médio",
        value: money(atual.ticketMedio),
        trend: pctDelta(atual.ticketMedio, anterior.ticketMedio),
        comparisonBase: anterior.ticketMedio,
        trendLabel: "vs período anterior",
        variant: "green",
        icon: "Target",
      },
      {
        key: "clientes",
        label: "Clientes",
        value: String(atual.clientes.size),
        subtitle: "clientes únicos",
        trend: pctDelta(atual.clientes.size, anterior.clientes.size),
        comparisonBase: anterior.clientes.size,
        trendLabel: "vs período anterior",
        variant: "orange",
        icon: "Users",
      },
      {
        key: "cancelados",
        label: "Pedidos Cancelados",
        value: String(atual.cancelados),
        subtitle: `${cancelPct}% do total`,
        variant: "red",
        icon: "XCircle",
      },
      {
        key: "pagos",
        label: "Pedidos Ativos/Pagos",
        value: String(atual.pagos),
        subtitle: `${pagosPct}% do total`,
        variant: "pink",
        icon: "CheckCircle2",
      },
    ],
    faturamentoDiario,
    pedidosDiarios,
    pagamentos,
    status,
    produtos,
    sabores,
    tamanhos,
    adicionais,
    clientes,
    porHora,
    porDiaSemana,
    receitaMensal,
    comparativos,
    entregaVsRetirada,
    tempoMedioMinutos,
    totalPedidosPeriodo: totalPedidos,
    cidades: Array.from(atual.cidades).sort(),
    bairros: Array.from(atual.bairros).sort(),
    meiosPagamento: Array.from(atual.meios).sort(),
    produtosDisponiveis: Array.from(atual.produtosSet).sort(),
    financeiro: {
      faturamentoBruto: Number(atual.faturamento.toFixed(2)),
      descontos: 0,
      taxaEntrega: Number(atual.taxaEntregaTotal.toFixed(2)),
      totalLiquido: Number(atual.faturamento.toFixed(2)),
      pagamentoMaisUsado: pagamentos[0]?.name || "—",
    },
    pedidosLista: rowsAtual
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 100)
      .map((p) => ({
        id: p.id,
        cliente: p.cliente_nome || "Cliente",
        data: p.created_at,
        status: mapStatusLabel(p.status),
        pagamento: mapPayLabel(p.meio_pagamento || ""),
        total: num(p.total),
      })),
    destaques: {
      maiorVenda:
        atual.totaisValidos.length > 0
          ? Math.max(...atual.totaisValidos)
          : 0,
      menorVenda:
        atual.totaisValidos.length > 0
          ? Math.min(...atual.totaisValidos)
          : 0,
      horarioPico:
        porHora.slice().sort((a, b) => b.pedidos - a.pedidos)[0]?.hora || "—",
      diaMaisPedidos:
        porDiaSemana.slice().sort((a, b) => b.pedidos - a.pedidos)[0]?.dia ||
        "—",
      produtoCampeao: produtos[0]?.nome || "—",
      clienteTop: clientes[0]?.nome || "—",
    },
    empresa: {
      nome: lojaRes.data?.nome || "Sorvetes Donda",
      logoUrl: lojaRes.data?.logo_url || null,
    },
    observacoes: null,
  };
}
