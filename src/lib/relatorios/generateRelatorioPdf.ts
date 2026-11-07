import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { RelatorioData, RelatorioFiltros } from "@/types/relatorios";
import {
  primaryReportKpis,
  reportClientStats,
  reportDate,
  reportDateKey,
  reportFilterLabels,
  reportMoney,
  reportNumber,
  reportValueLabel,
  validReportTrend,
} from "./presentation";

type RGB = [number, number, number];
const INK: RGB = [31, 26, 38],
  MUTED: RGB = [111, 104, 120],
  SUBTLE: RGB = [154, 147, 163],
  PURPLE: RGB = [76, 37, 140],
  PURPLE_SOFT: RGB = [243, 239, 250],
  BORDER: RGB = [233, 229, 239],
  STRIPE: RGB = [250, 249, 252],
  GREEN: RGB = [15, 138, 95],
  RED: RGB = [180, 35, 50];
const M = 16,
  W = 178,
  TOP = 24,
  BOTTOM = 272;
type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } };
export type GeneratePdfOptions = {
  data: RelatorioData;
  emitidoPor: string;
  filtros?: RelatorioFiltros;
};

/** Vector content throughout: independent of viewport size and browser chart rendering. */
export async function generateRelatorioPdf({
  data,
  emitidoPor,
  filtros,
}: GeneratePdfOptions): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true }) as PdfDoc;
  const empresa = data.empresa.nome || "Sorvetes Donda";
  doc.setProperties({
    title: "Relatório de desempenho",
    subject: data.range.label,
    author: empresa,
    creator: "Sorvetes Donda",
  });
  const periodo = `${reportDate(data.range.from)} – ${reportDate(data.range.to)}`;
  let y = 20;

  const text = (
    value: string,
    x: number,
    at: number,
    size = 9,
    color: RGB = INK,
    bold = false,
    align: "left" | "right" | "center" = "left",
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(value, x, at, { align });
  };
  /** Trunca para caber na largura (jsPDF não faz ellipsis). */
  const fit = (value: string, width: number, size: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (doc.getTextWidth(value) <= width) return value;
    let out = value;
    while (out.length > 1 && doc.getTextWidth(out + "…") > width) out = out.slice(0, -1);
    return out.trimEnd() + "…";
  };
  const ensure = (height: number) => {
    if (y + height > BOTTOM) {
      doc.addPage();
      y = TOP + 6;
    }
  };
  const paragraph = (value: string, size = 8, color: RGB = MUTED) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(value, W);
    for (const line of lines) {
      ensure(5);
      text(line, M, y, size, color);
      y += size * 0.5;
    }
    y += 2;
  };
  const section = (value: string, room = 26) => {
    ensure(room);
    doc.setFillColor(...PURPLE);
    doc.roundedRect(M, y - 3.6, 1.2, 4.6, 0.6, 0.6, "F");
    text(value, M + 4, y, 11.5, INK, true);
    y += 7;
  };
  const box = (x: number, top: number, w: number, h: number, fill?: RGB) => {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    if (fill) doc.setFillColor(...fill);
    doc.roundedRect(x, top, w, h, 2, 2, fill ? "FD" : "S");
  };

  /** Tabela padrão; `shareColumn` desenha uma barra de participação (0–100) na coluna. */
  const table = (
    heading: string,
    head: string[],
    body: RowInput[],
    opts: {
      right?: number[];
      shareColumn?: number;
      shares?: number[];
      foot?: RowInput;
      widths?: Record<number, number>;
    } = {},
  ) => {
    const right = opts.right ?? [];
    // Reserva espaço para título + cabeçalho + algumas linhas, evitando tabelas curtas partidas.
    section(heading, body.length ? 18 + Math.min(body.length + (opts.foot ? 1 : 0), 6) * 8 : 20);
    if (!body.length) {
      paragraph("Sem registros neste período.");
      y += 4;
      return;
    }
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: TOP + 4, bottom: 300 - BOTTOM },
      tableWidth: W,
      head: [head],
      body,
      foot: opts.foot ? [opts.foot] : undefined,
      theme: "plain",
      showHead: "everyPage",
      showFoot: "lastPage",
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: 8.2,
        cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
        textColor: INK,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        textColor: MUTED,
        fontStyle: "bold",
        fontSize: 7.2,
        lineColor: BORDER,
        lineWidth: { bottom: 0.3 },
      },
      footStyles: {
        fontStyle: "bold",
        textColor: INK,
        lineColor: BORDER,
        lineWidth: { top: 0.3 },
      },
      alternateRowStyles: { fillColor: STRIPE },
      columnStyles: Object.fromEntries([
        ...right.map((index) => [index, { halign: "right" as const }]),
        ...Object.entries(opts.widths ?? {}).map(([index, cellWidth]) => [
          Number(index),
          { cellWidth, ...(right.includes(Number(index)) ? { halign: "right" as const } : {}) },
        ]),
      ]),
      didParseCell: (hook) => {
        if (hook.section !== "body" && right.includes(hook.column.index)) hook.cell.styles.halign = "right";
      },
      didDrawCell: (hook) => {
        if (hook.section !== "body" || opts.shareColumn !== hook.column.index || !opts.shares) return;
        const share = Math.max(0, Math.min(100, opts.shares[hook.row.index] ?? 0));
        const barW = Math.max(8, hook.cell.width - 22);
        const bx = hook.cell.x + 2.5,
          by = hook.cell.y + hook.cell.height / 2 - 0.9;
        doc.setFillColor(...PURPLE_SOFT);
        doc.roundedRect(bx, by, barW, 1.8, 0.9, 0.9, "F");
        if (share > 0) {
          doc.setFillColor(...PURPLE);
          doc.roundedRect(bx, by, Math.max(1.8, (barW * share) / 100), 1.8, 0.9, 0.9, "F");
        }
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 11;
  };

  // ───────────── Capa ─────────────
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, 210, 3, "F");
  let logoWidth = 0;
  if (data.empresa.logoUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(data.empresa.logoUrl, { signal: controller.signal });
        if (res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          const image = doc.getImageProperties(bytes);
          const scale = Math.min(14 / image.width, 12 / image.height);
          logoWidth = image.width * scale;
          doc.addImage(bytes, image.fileType, M, 11, logoWidth, image.height * scale);
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      /* O relatório continua utilizável sem o logo opcional. */
    }
  }
  text(empresa, M + (logoWidth ? logoWidth + 4 : 0), 18.5, 11, PURPLE, true);
  const emitted = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
  text(`Emitido em ${emitted}`, M + W, 18.5, 8, MUTED, false, "right");

  text("Relatório de desempenho", M, 37, 22, INK, true);
  text(`${periodo}  ·  ${data.range.label}`, M, 45, 10.5, MUTED);

  // Quadro de informações
  const selectedFilters = reportFilterLabels(filtros);
  const meta: [string, string][] = [
    ["Comparado com", `${reportDate(data.prevRange.from)} – ${reportDate(data.prevRange.to)}`],
    ["Filtros", selectedFilters.length ? selectedFilters.join(", ") : "Todos os pedidos"],
    ["Emitido por", emitidoPor || "—"],
  ];
  const metaW = W / 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const metaLines = meta.map(([, value]) => (doc.splitTextToSize(value, metaW - 9) as string[]).slice(0, 2));
  const metaH = metaLines.some((lines) => lines.length > 1) ? 19 : 15;
  box(M, 51, W, metaH, STRIPE);
  meta.forEach(([label], i) => {
    const x = M + 5 + i * metaW;
    text(label.toUpperCase(), x, 56.5, 6.5, SUBTLE, true);
    metaLines[i].forEach((line, li) => text(li === 1 ? fit(line, metaW - 9, 8.5) : line, x, 61.5 + li * 4, 8.5, INK));
  });
  y = 51 + metaH + 9;

  // Indicadores
  const kpis = primaryReportKpis(data.kpis);
  const gap = 4,
    cardW = (W - gap * 3) / 4,
    cardH = 25;
  kpis.forEach((kpi, index) => {
    const x = M + index * (cardW + gap);
    box(x, y, cardW, cardH);
    text(fit(kpi.label, cardW - 8, 7.8), x + 4, y + 7, 7.8, MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    const size = Math.min(15, (15 * (cardW - 8)) / Math.max(doc.getTextWidth(kpi.value), cardW - 8));
    text(kpi.value, x + 4, y + 15, size, INK, true);
    const trend = validReportTrend(kpi);
    text(
      trend == null ? "Sem comparação" : `${trend > 0 ? "+" : ""}${reportNumber(trend, 1)}% vs. anterior`,
      x + 4,
      y + 21,
      7,
      trend == null || trend === 0 ? SUBTLE : trend > 0 ? GREEN : RED,
      trend != null && trend !== 0,
    );
  });
  y += cardH + 10;

  // Destaques
  if (data.totalPedidosPeriodo > 0) {
    section("Destaques do período", 40);
    const highlights: [string, string][] = [
      ["Maior venda", reportMoney(data.destaques.maiorVenda)],
      ["Menor venda", reportMoney(data.destaques.menorVenda)],
      ["Horário de pico", data.destaques.horarioPico || "—"],
      ["Dia com mais pedidos", data.destaques.diaMaisPedidos || "—"],
      ["Produto mais vendido", data.destaques.produtoCampeao || "—"],
      ["Cliente que mais comprou", data.destaques.clienteTop || "—"],
    ];
    const colW = W / 3,
      rowH = 12;
    box(M, y - 1, W, rowH * 2 + 2);
    highlights.forEach(([label, value], i) => {
      const col = i % 3,
        row = Math.floor(i / 3);
      const x = M + 5 + col * colW,
        top = y + row * rowH;
      text(label, x, top + 4.5, 7.2, MUTED);
      text(fit(value, colW - 9, 9.5, true), x, top + 9.5, 9.5, INK, true);
    });
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(M + 4, y + rowH, M + W - 4, y + rowH);
    y += rowH * 2 + 12;
  }

  // Gráfico de faturamento diário (barras)
  section("Faturamento por dia", 78);
  const series = data.faturamentoDiario;
  const valid = series.filter((row) => Number.isFinite(row.faturamento));
  if (!valid.length) {
    paragraph("Sem informações de vendas para o período.");
  } else if (!valid.some((row) => row.faturamento > 0)) {
    paragraph(`Nenhuma venda registrada no período. Faturamento: ${reportMoney(0)}.`);
  } else {
    const x = M + 16,
      chartW = W - 18,
      top = y + 2,
      h = 46,
      max = Math.max(...valid.map((row) => row.faturamento), 1);
    const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
    for (let tick = 0; tick <= 4; tick++) {
      const cy = top + h - (tick * h) / 4;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(tick === 0 ? 0.3 : 0.15);
      doc.line(x, cy, x + chartW, cy);
      text(compact.format((max * tick) / 4), x - 2.5, cy + 1, 6.8, SUBTLE, false, "right");
    }
    const slot = chartW / series.length;
    const barW = Math.min(9, Math.max(0.8, slot * 0.62));
    doc.setFillColor(...PURPLE);
    series.forEach((row, index) => {
      if (!Number.isFinite(row.faturamento) || row.faturamento <= 0) return;
      const bh = Math.max(0.4, (row.faturamento / max) * h);
      const bx = x + index * slot + (slot - barW) / 2;
      doc.rect(bx, top + h - bh, barW, bh, "F");
      if (series.length <= 10)
        text(reportMoney(row.faturamento), bx + barW / 2, top + h - bh - 1.8, 6.3, MUTED, false, "center");
    });
    const step = Math.max(1, Math.ceil(series.length / 8));
    const last = series.length - 1;
    series.forEach((row, index) => {
      const regular = index % step === 0 && (index === last || last - index >= step / 2);
      if (regular || index === last)
        text(row.label, x + index * slot + slot / 2, top + h + 4.5, 6.8, SUBTLE, false, "center");
    });
    y = top + h + 9;
    paragraph(`Valores em reais. Maior faturamento em um dia: ${reportMoney(max)}.`, 7, SUBTLE);
    y += 4;
  }

  // Financeiro
  table(
    "Resumo financeiro",
    ["Indicador", "Valor"],
    [
      ["Faturamento bruto", reportMoney(data.financeiro.faturamentoBruto)],
      ["Descontos", reportMoney(data.financeiro.descontos)],
      ["Taxas de entrega", reportMoney(data.financeiro.taxaEntrega)],
      ["Pagamento mais usado", data.financeiro.pagamentoMaisUsado],
    ],
    { right: [1], foot: ["Total líquido", reportMoney(data.financeiro.totalLiquido)] },
  );

  // Produtos
  const produtoQtd = data.produtos.reduce((sum, row) => sum + row.quantidade, 0);
  const produtoReceita = data.produtos.reduce((sum, row) => sum + row.faturamento, 0);
  table(
    "Produtos mais vendidos",
    ["#", "Produto", "Qtd.", "Receita", "Participação"],
    data.produtos.map((row, index) => [
      String(index + 1),
      row.nome,
      reportNumber(row.quantidade),
      reportMoney(row.faturamento),
      `${reportNumber(row.participacao, 1)}%`,
    ]),
    {
      right: [2, 3, 4],
      shareColumn: 4,
      shares: data.produtos.map((row) => row.participacao),
      widths: { 0: 9, 2: 16, 3: 26, 4: 40 },
      foot: data.produtos.length
        ? ["", "Total", reportNumber(produtoQtd), reportMoney(produtoReceita), ""]
        : undefined,
    },
  );

  const distribution = (heading: string, label: string, rows: { name: string; value: number }[]) => {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    table(
      heading,
      [label, "Pedidos", "Participação"],
      rows.map((row) => [
        row.name,
        reportNumber(row.value),
        total > 0 ? `${reportNumber((row.value / total) * 100, 1)}%` : "Sem base",
      ]),
      {
        right: [1, 2],
        shareColumn: 2,
        shares: rows.map((row) => (total > 0 ? (row.value / total) * 100 : 0)),
        widths: { 1: 22, 2: 56 },
      },
    );
  };
  distribution("Formas de pagamento", "Pagamento", data.pagamentos);
  distribution("Pedidos por status", "Status", data.status);
  distribution("Canais", "Canal", data.entregaVsRetirada);

  // Todos os intervalos de hora são preservados, inclusive os zerados, em duas colunas.
  const hours = data.porHora,
    mid = Math.ceil(hours.length / 2);
  table(
    "Pedidos por horário",
    ["Horário", "Pedidos", "Horário", "Pedidos"],
    hours
      .slice(0, mid)
      .map((row, index) => [
        row.hora,
        reportNumber(row.pedidos),
        hours[index + mid]?.hora ?? "",
        hours[index + mid] ? reportNumber(hours[index + mid].pedidos) : "",
      ]),
    { right: [1, 3] },
  );

  // Clientes
  section("Clientes", 40);
  if (!data.clientes.length) {
    paragraph("Nenhum cliente identificado no período.");
    y += 4;
  } else {
    const stats = reportClientStats(data.clientes);
    const items: [string, string][] = [
      ["Uma compra", reportNumber(stats.single)],
      ["Duas ou mais", reportNumber(stats.repeat)],
      ["Frequência média", `${reportNumber(stats.frequency, 1)} pedidos`],
      ["Ticket médio por cliente", reportMoney(stats.ticket)],
    ];
    const colW = W / 4;
    box(M, y - 1, W, 14);
    items.forEach(([label, value], i) => {
      const x = M + 5 + i * colW;
      text(label, x, y + 4, 7.2, MUTED);
      text(fit(value, colW - 9, 10, true), x, y + 9.5, 10, INK, true);
    });
    y += 18;
    paragraph(
      `Base: ${data.clientes.length} clientes do ranking. Uma compra no período não indica, por si só, cliente novo.`,
      7,
      SUBTLE,
    );
    y += 2;
  }
  table(
    "Ranking de clientes",
    ["Cliente", "Pedidos", "Total gasto", "Ticket médio", "Última compra"],
    data.clientes.map((row) => [
      row.nome,
      reportNumber(row.pedidos),
      reportMoney(row.totalGasto),
      reportMoney(row.ticketMedio),
      reportDate(row.ultimaCompra),
    ]),
    { right: [1, 2, 3, 4] },
  );
  if (data.sabores.length)
    table(
      "Sabores mais vendidos",
      ["Sabor", "Qtd.", "Receita"],
      data.sabores.map((row) => [row.nome, reportNumber(row.quantidade), reportMoney(row.faturamento)]),
      { right: [1, 2] },
    );
  if (data.adicionais.length)
    table(
      "Adicionais mais vendidos",
      ["Adicional", "Qtd.", "Receita"],
      data.adicionais.map((row) => [row.nome, reportNumber(row.quantidade), reportMoney(row.faturamento)]),
      { right: [1, 2] },
    );
  table(
    "Pedidos do período",
    ["Pedido", "Cliente", "Data", "Status", "Pagamento", "Total"],
    data.pedidosLista.map((row) => [
      "#" + row.id.slice(0, 8),
      row.cliente,
      reportDate(row.data),
      reportValueLabel(row.status),
      reportValueLabel(row.pagamento),
      reportMoney(row.total),
    ]),
    { right: [5], widths: { 0: 22, 2: 22, 5: 24 } },
  );
  if (data.tempoMedioMinutos != null)
    paragraph(`Tempo médio até a conclusão dos pedidos: ${reportNumber(data.tempoMedioMinutos)} min.`, 8, MUTED);
  if (data.observacoes?.trim()) {
    section("Observações");
    paragraph(data.observacoes.trim(), 8.5, INK);
  }

  // ───────────── Cabeçalho e rodapé de todas as páginas ─────────────
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFillColor(...PURPLE);
      doc.rect(0, 0, 210, 1.5, "F");
      text(empresa, M, 13, 8, PURPLE, true);
      text(`Relatório de desempenho · ${periodo}`, M + W, 13, 7.5, MUTED, false, "right");
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(M, 17, M + W, 17);
    }
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(M, 281, M + W, 281);
    text(`${empresa} · ${periodo}`, M, 286.5, 7, SUBTLE);
    text(`Página ${page} de ${pages}`, M + W, 286.5, 7, SUBTLE, false, "right");
  }
  return {
    blob: doc.output("blob"),
    filename: `SorvetesDonda_Relatorio_${reportDateKey(data.range.from)}_a_${reportDateKey(data.range.to)}.pdf`,
  };
}
export { downloadPdfBlob } from "./download";
