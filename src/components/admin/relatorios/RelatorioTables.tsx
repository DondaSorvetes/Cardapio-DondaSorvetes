"use client";
import { useState } from "react";
import type { ClienteRank, Comparativo, ProdutoRank } from "@/types/relatorios";
import { Button } from "@/components/ui/button";
import {
  reportClientStats,
  reportMoney,
  reportNumber,
} from "@/lib/relatorios/presentation";
import { ReportEmpty, ReportPanel } from "./RelatorioCharts";
export function TabelaProdutos({
  data,
  initialLimit = 10,
}: {
  data: ProdutoRank[];
  initialLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false),
    list = expanded ? data : data.slice(0, initialLimit);
  return (
    <ReportPanel title="Produtos mais vendidos">
      {!data.length ? (
        <ReportEmpty>Nenhum produto vendido no período.</ReportEmpty>
      ) : (
        <>
          <div className="report-table-wrap">
            <table className="report-table report-products">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd.</th>
                  <th>Receita</th>
                  <th>Participação</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, index) => (
                  <tr key={row.nome}>
                    <td>
                      <span className="report-rank">{index + 1}</span>
                      {row.nome}
                    </td>
                    <td data-label="Quantidade">
                      {reportNumber(row.quantidade)}
                    </td>
                    <td data-label="Receita">{reportMoney(row.faturamento)}</td>
                    <td data-label="Participação">
                      <span className="report-share">
                        <span className="report-bar" aria-hidden="true">
                          <span style={{ width: `${Math.min(100, row.participacao)}%`, backgroundColor: "#C8285F" }} />
                        </span>
                        {reportNumber(row.participacao, 1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > initialLimit && (
            <Button
              variant="ghost"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded
                ? "Mostrar menos"
                : `Ver todos os ${data.length} produtos`}
            </Button>
          )}
        </>
      )}
    </ReportPanel>
  );
}
export function TabelaClientes({ data }: { data: ClienteRank[] }) {
  const stats = reportClientStats(data);
  return (
    <ReportPanel title="Comportamento dos clientes">
      {!data.length ? (
        <ReportEmpty>Nenhum cliente identificado no período.</ReportEmpty>
      ) : (
        <>
          <dl className="report-client-stats">
            <div>
              <dt>Uma compra no período</dt>
              <dd>{reportNumber(stats.single)}</dd>
            </div>
            <div>
              <dt>Duas ou mais compras</dt>
              <dd>{reportNumber(stats.repeat)}</dd>
            </div>
            <div>
              <dt>Frequência média</dt>
              <dd>{reportNumber(stats.frequency, 1)} pedidos</dd>
            </div>
            <div>
              <dt>Média dos tickets por cliente</dt>
              <dd>{reportMoney(stats.ticket)}</dd>
            </div>
          </dl>
          {data[0] && (
            <p className="report-top-client">
              <span>Maior comprador no ranking</span>
              <strong>{data[0].nome}</strong>
              {reportNumber(data[0].pedidos)} pedidos ·{" "}
              {reportMoney(data[0].totalGasto)}
            </p>
          )}
        </>
      )}
    </ReportPanel>
  );
}
export function ComparativosCards({ data }: { data: Comparativo[] }) {
  return (
    <ReportPanel title="Faturamento por período">
      {!data.length ? (
        <ReportEmpty />
      ) : (
        <ul className="report-value-list">
          {data.map((row) => (
            <li key={row.label}>
              <span>
                {row.label}
                <small>
                  {reportMoney(row.atual)} / {reportMoney(row.anterior)}
                </small>
              </span>
              <strong>
                {row.anterior > 0 &&
                row.deltaPct != null &&
                Number.isFinite(row.deltaPct)
                  ? `${row.deltaPct > 0 ? "+" : ""}${reportNumber(row.deltaPct, 1)}%`
                  : "Sem base comparável"}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </ReportPanel>
  );
}
export function TabelaRanking({
  title,
  data,
}: {
  title: string;
  data: { nome: string; quantidade: number; faturamento?: number }[];
}) {
  return (
    <ReportPanel title={title}>
      {!data.length ? (
        <ReportEmpty />
      ) : (
        <ol className="report-value-list">
          {data.slice(0, 8).map((row) => (
            <li key={row.nome}>
              <span>{row.nome}</span>
              <strong>{reportNumber(row.quantidade)}</strong>
            </li>
          ))}
        </ol>
      )}
    </ReportPanel>
  );
}
export function TabelaTamanhos({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <TabelaRanking
      title="Tamanhos"
      data={data.map((row) => ({ nome: row.name, quantidade: row.value }))}
    />
  );
}
