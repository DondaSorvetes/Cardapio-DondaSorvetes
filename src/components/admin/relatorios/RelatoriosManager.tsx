"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRelatorios } from "@/actions/admin/relatorios";
import type {
  RelatorioData,
  RelatorioFiltros,
  RelatorioPeriodoPreset,
} from "@/types/relatorios";
import { RelatorioDestaques, RelatorioKpiCards } from "./RelatorioKpiCards";
import {
  ChartFaturamento,
  ChartHoras,
  ChartPedidosBar,
  ChartPizza,
  ChartCategorias,
} from "./RelatorioCharts";
import {
  ComparativosCards,
  TabelaClientes,
  TabelaProdutos,
} from "./RelatorioTables";
import { createClient } from "@/lib/supabase/client";
import {downloadPdfBlob} from "@/lib/relatorios/download";
import {
  reportDate,
  reportDateKey,
  reportFilterLabels,
  reportMoney,
  reportValueLabel,
} from "@/lib/relatorios/presentation";
import "./relatorios.css";

const PRESETS: { id: RelatorioPeriodoPreset; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "mes", label: "Este mês" },
  { id: "custom", label: "Personalizado" },
];
const DEFAULT_FILTERS: RelatorioFiltros = {
  preset: "30d",
  status: "todos",
  meio_pagamento: "todos",
  tipo_entrega: "todos",
};
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;
function exportCSV(data: RelatorioData) {
  const rows: unknown[][] = [
    ["Relatório Sorvetes Donda"],
    ["Período", data.range.label],
    [],
    ["KPI", "Valor"],
    ...data.kpis.map((k) => [k.label, k.value]),
    [],
    ["Produtos", "Quantidade", "Faturamento", "Participação%"],
    ...data.produtos.map((p) => [
      p.nome,
      p.quantidade,
      p.faturamento.toFixed(2),
      p.participacao,
    ]),
    [],
    ["Clientes", "Pedidos", "Total", "Ticket", "Última compra"],
    ...data.clientes.map((c) => [
      c.nome,
      c.pedidos,
      c.totalGasto.toFixed(2),
      c.ticketMedio.toFixed(2),
      c.ultimaCompra,
    ]),
  ];
  downloadPdfBlob(
    new Blob(
      ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    ),
    `SorvetesDonda_Relatorio_${reportDateKey(data.range.from)}_a_${reportDateKey(data.range.to)}.csv`,
  );
}
function Skeleton() {
  return (
    <div
      className="report-skeleton"
      role="status"
      aria-label="Carregando relatórios"
    >
      <div className="report-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} />
        ))}
      </div>
      <div className="report-skeleton-chart" />
    </div>
  );
}

export function RelatoriosManager() {
  const [filters, setFilters] = useState<RelatorioFiltros>(DEFAULT_FILTERS);
  const [dates, setDates] = useState({ from: "", to: "" });
  const [data, setData] = useState<RelatorioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [adminName, setAdminName] = useState("Administrador");
  const sequence = useRef(0),
    exportLock = useRef(false);
  const [loadedFilters, setLoadedFilters] =
    useState<RelatorioFiltros>(DEFAULT_FILTERS);
  const load = useCallback((next: RelatorioFiltros) => {
    const request = ++sequence.current;
    setError(null);
    startTransition(async () => {
      try {
        const result = await getRelatorios(next);
        if (request !== sequence.current) return;
        setData(result);
        setLoadedFilters(next);
      } catch (e) {
        if (request === sequence.current)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar o relatório.",
          );
      }
    });
  }, []);
  useEffect(() => {
    load(DEFAULT_FILTERS);
    try {
      const name =
        localStorage.getItem("donda-admin-name") ||
        document
          .querySelector("[data-admin-name]")
          ?.getAttribute("data-admin-name");
      if (name) setAdminName(name);
    } catch {}
  }, [load]);
  useEffect(() => {
    const client = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = client
      .channel(
        `relatorios-pedidos-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => load(filters), 800);
        },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [filters, load]);
  const apply = (next: RelatorioFiltros) => {
    setFilters(next);
    load(next);
  };
  const active = reportFilterLabels(filters);
  const dataMatches = JSON.stringify(filters) === JSON.stringify(loadedFilters);
  const exportDisabled =
    !data ||
    isPending ||
    exporting ||
    !dataMatches ||
    customOpen ||
    Boolean(error);
  const exportReport = async (kind: "pdf" | "excel" | "csv") => {
    if (exportLock.current || exportDisabled || !data) return;
    exportLock.current = true;
    setExporting(true);
    try {
      // Export the exact loaded snapshot and its filters, including during realtime updates.
      if (kind === "pdf") {
        const {generateRelatorioPdf}=await import("@/lib/relatorios/generateRelatorioPdf");
        const result = await generateRelatorioPdf({
          data,
          emitidoPor: adminName,
          filtros: loadedFilters,
        });
        downloadPdfBlob(result.blob, result.filename);
      } else exportCSV(data); // Excel keeps the existing CSV-compatible export.
      toast.success(
        kind === "pdf"
          ? "PDF exportado"
          : kind === "excel"
            ? "Arquivo compatível com Excel exportado"
            : "CSV exportado",
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível exportar o relatório.",
      );
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  };
  const customSelected = customOpen || filters.preset === "custom";
  return (
    <div className="report-page">
      <header className="report-header">
        <h1>Relatórios</h1>
        <div className="report-header-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="report-export" disabled={exportDisabled}>
                {exporting && (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                )}
                {exporting ? "Gerando…" : "Exportar"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void exportReport("pdf")}>
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportReport("excel")}>
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportReport("csv")}>
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="report-presets" role="group" aria-label="Período">
        {PRESETS.map((p) => {
          const selected = p.id === "custom" ? customSelected : !customOpen && filters.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              className={selected ? "is-active" : undefined}
              onClick={() => {
                if (p.id === "custom") {
                  setDates({
                    from: filters.from?.slice(0, 10) || (data ? reportDateKey(data.range.from) : "") || "",
                    to: filters.to?.slice(0, 10) || (data ? reportDateKey(data.range.to) : "") || "",
                  });
                  setCustomOpen(true);
                } else {
                  setCustomOpen(false);
                  apply({ ...filters, preset: p.id, from: undefined, to: undefined });
                }
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {customSelected && (
        <form
          className="report-custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dates.from || !dates.to || dates.from > dates.to) return;
            setCustomOpen(false);
            apply({
              ...filters,
              preset: "custom",
              from: dates.from,
              to: dates.to,
            });
          }}
        >
          <label>
            De
            <input
              name="report-from"
              type="date"
              required
              value={dates.from}
              max={dates.to || undefined}
              onChange={(e) =>
                setDates((current) => ({ ...current, from: e.target.value }))
              }
            />
          </label>
          <label>
            Até
            <input
              name="report-to"
              type="date"
              required
              value={dates.to}
              min={dates.from || undefined}
              onChange={(e) =>
                setDates((current) => ({ ...current, to: e.target.value }))
              }
            />
          </label>
          <Button type="submit" disabled={isPending}>
            Aplicar período
          </Button>
        </form>
      )}
      <div className="report-toolbar">
        <div className="report-period-summary" aria-live="polite">
          {data ? (
            <span>
              {reportDate(data.range.from)} – {reportDate(data.range.to)}
            </span>
          ) : (
            <span>Preparando relatório…</span>
          )}
          {isPending && <span role="status">Atualizando…</span>}
        </div>
        <Button
          variant="outline"
          className="report-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="report-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filtros{active.length > 0 ? ` (${active.length})` : ""}
        </Button>
      </div>
      <div
        id="report-filters"
        className={`report-filters ${filtersOpen ? "is-open" : ""}`}
      >
        <label>
          <span className="sr-only">Status</span>
          <select
            aria-label="Status"
            name="status"
            value={filters.status}
            onChange={(e) => apply({ ...filters, status: e.target.value })}
          >
            {[
              ["todos", "Todos os status"],
              ["pendente", "Novo"],
              ["preparando", "Em preparo"],
              ["saiu_entrega", "Saiu para entrega"],
              ["entregue", "Finalizado"],
              ["cancelado", "Cancelado"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Pagamento</span>
          <select
            aria-label="Pagamento"
            name="pagamento"
            value={filters.meio_pagamento}
            onChange={(e) =>
              apply({ ...filters, meio_pagamento: e.target.value })
            }
          >
            <option value="todos">Todos os pagamentos</option>
            {[
              ...new Set([
                "pix",
                "dinheiro",
                "debito",
                "credito",
                ...(data?.meiosPagamento ?? []),
              ]),
            ].map((value) => (
              <option key={value} value={value}>
                {reportValueLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Canal</span>
          <select
            aria-label="Canal"
            name="canal"
            value={filters.tipo_entrega}
            onChange={(e) =>
              apply({ ...filters, tipo_entrega: e.target.value })
            }
          >
            <option value="todos">Todos os canais</option>
            <option value="entrega">Entrega</option>
            <option value="retirada">Retirada</option>
          </select>
        </label>
        {active.length > 0 && (
          <Button
            variant="ghost"
            onClick={() =>
              apply({
                ...filters,
                status: "todos",
                meio_pagamento: "todos",
                tipo_entrega: "todos",
              })
            }
          >
            Limpar filtros
          </Button>
        )}
      </div>
      {active.length > 0 && (
        <p className="report-active-filters">{active.join(" · ")}</p>
      )}
      {error && (
        <div role="alert" className="report-error">
          <p>{error}</p>
          <Button variant="outline" onClick={() => load(filters)}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!data ? (
        error ? (
          <p className="report-empty">
            Os dados do relatório não estão disponíveis.
          </p>
        ) : (
          <Skeleton />
        )
      ) : (
        <div className="report-content" aria-busy={isPending}>
          <RelatorioKpiCards kpis={data.kpis} previousRange={data.prevRange} />
          <RelatorioDestaques data={data} />
          <Tabs defaultValue="geral" className="report-tabs">
            <TabsList aria-label="Análises do relatório">
              <TabsTrigger value="geral">Visão geral</TabsTrigger>
              <TabsTrigger value="operacional">Operacional</TabsTrigger>
              <TabsTrigger value="comercial">Comercial</TabsTrigger>
            </TabsList>
            <TabsContent value="geral">
              <div className="report-overview">
                <ChartFaturamento data={data.faturamentoDiario} />
                <ChartPizza data={data.pagamentos} />
              </div>
              <TabelaProdutos data={data.produtos} initialLimit={6} />
              <details className="report-comparisons">
                <summary>Comparações de calendário</summary>
                <p>
                  Faturamento dos períodos indicados abaixo, independentemente
                  do período selecionado.
                </p>
                <ComparativosCards data={data.comparativos} />
              </details>
            </TabsContent>
            <TabsContent value="operacional">
              <div className="report-operations">
                <ChartHoras data={data.porHora} />
                <ChartPedidosBar data={data.status} />
                <ChartCategorias data={data.entregaVsRetirada} />
              </div>
              {data.pedidosLista.length > 0 && (
                <section className="report-panel">
                  <h2>Pedidos do período</h2>
                  <div className="report-table-wrap">
                    <table className="report-table report-orders">
                      <thead>
                        <tr>
                          <th>Pedido / cliente</th>
                          <th>Status</th>
                          <th>Pagamento</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.pedidosLista.slice(0, 10).map((order) => (
                          <tr key={order.id}>
                            <td>
                              <strong>#{order.id.slice(0, 8)}</strong>
                              <span>{order.cliente}</span>
                            </td>
                            <td>{reportValueLabel(order.status)}</td>
                            <td>{reportValueLabel(order.pagamento)}</td>
                            <td>{reportMoney(order.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </TabsContent>
            <TabsContent value="comercial">
              <TabelaProdutos data={data.produtos} />
              <div className="report-commercial">
                <TabelaClientes data={data.clientes} />
                <ChartPizza data={data.pagamentos} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
