"use client";
import type { KpiCard, RelatorioData } from "@/types/relatorios";
import {
  primaryReportKpis,
  reportDate,
  reportMoney,
  reportNumber,
  validReportTrend,
} from "@/lib/relatorios/presentation";

export function RelatorioKpiCards({
  kpis,
  previousRange,
}: {
  kpis: KpiCard[];
  previousRange?: { from: string; to: string };
}) {
  return (
    <section aria-label="Indicadores principais">
      <dl className="report-kpis">
        {primaryReportKpis(kpis).map((kpi) => {
          const trend = validReportTrend(kpi);
          return (
            <div key={kpi.key}>
              <dt>{kpi.label}</dt>
              <dd>{kpi.value}</dd>
              <p
                className={
                  trend == null ? "" : trend > 0 ? "report-up" : trend < 0 ? "report-down" : ""
                }
              >
                {trend == null
                  ? "Sem comparação"
                  : `${trend > 0 ? "+" : ""}${reportNumber(trend, 1)}% vs. anterior`}
              </p>
            </div>
          );
        })}
      </dl>
      {previousRange && (
        <p className="report-comparison-caption">
          Período anterior: {reportDate(previousRange.from)} – {reportDate(previousRange.to)}
        </p>
      )}
    </section>
  );
}

/** Linha de destaques do período: respostas rápidas sem precisar abrir as tabelas. */
export function RelatorioDestaques({ data }: { data: RelatorioData }) {
  if (!data.totalPedidosPeriodo) return null;
  const items: [string, string][] = [
    ["Maior venda", reportMoney(data.destaques.maiorVenda)],
    ["Horário de pico", data.destaques.horarioPico || "—"],
    ["Dia mais movimentado", data.destaques.diaMaisPedidos || "—"],
    ["Produto campeão", data.destaques.produtoCampeao || "—"],
  ];
  return (
    <dl className="report-highlights" aria-label="Destaques do período">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
