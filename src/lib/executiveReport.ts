import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoSante from "@/assets/logo-sante.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import {
  OrcamentoRow,
  dedupeByOrcamento,
  dedupeByRequisicao,
  fmtBRLFull,
  fmtInt,
} from "@/lib/orcamento";

export type ExecutiveFilters = {
  dateFrom: string;
  dateTo: string;
  convenio: string;
  atendente?: string;
};

type Venda = {
  atendente: string;
  data_venda: string;
  valor: number;
  tipo: "exames" | "checkup";
};

function readCommissionConfig() {
  const def = { pctOrc: 2, pctExames: 1.5, pctCheckup: 1.5 };
  if (typeof window === "undefined") return def;
  try {
    const orc = parseFloat(window.localStorage.getItem("comissao.pct") || "");
    if (Number.isFinite(orc) && orc >= 0) def.pctOrc = orc;
    const raw = window.localStorage.getItem("commissionConfig.v1");
    if (raw) {
      const p = JSON.parse(raw);
      if (Number.isFinite(p?.pctExames)) def.pctExames = Number(p.pctExames);
      if (Number.isFinite(p?.pctCheckup)) def.pctCheckup = Number(p.pctCheckup);
    }
  } catch { /* noop */ }
  return def;
}

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(logoSante.url);
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function dateRangeLabel(f: ExecutiveFilters): string {
  const f1 = f.dateFrom ? new Date(f.dateFrom + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  const f2 = f.dateTo ? new Date(f.dateTo + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  return `${f1} a ${f2}`;
}

function applyFilters(rows: OrcamentoRow[], f: ExecutiveFilters): OrcamentoRow[] {
  const from = f.dateFrom ? new Date(f.dateFrom + "T00:00:00") : null;
  const to = f.dateTo ? new Date(f.dateTo + "T23:59:59") : null;
  return rows.filter((r) => {
    if (from || to) {
      if (!r.data) return false;
      if (from && r.data < from) return false;
      if (to && r.data > to) return false;
    }
    if (f.convenio !== "all" && r.convenioPrincipal !== f.convenio) return false;
    if (f.atendente && f.atendente !== "all" && r.usuario !== f.atendente) return false;
    return true;
  });
}

function applyFiltersPagos(rows: OrcamentoRow[], f: ExecutiveFilters): OrcamentoRow[] {
  const from = f.dateFrom ? new Date(f.dateFrom + "T00:00:00") : null;
  const to = f.dateTo ? new Date(f.dateTo + "T23:59:59") : null;
  return rows.filter((r) => {
    if (!r.pago || !r.dataPagamento) return false;
    if (from && r.dataPagamento < from) return false;
    if (to && r.dataPagamento > to) return false;
    if (f.convenio !== "all" && r.convenioPrincipal !== f.convenio) return false;
    if (f.atendente && f.atendente !== "all" && r.usuario !== f.atendente) return false;
    return true;
  });
}

async function fetchVendas(f: ExecutiveFilters): Promise<Venda[]> {
  try {
    let q = supabase.from("vendas").select("atendente,data_venda,valor,tipo");
    if (f.dateFrom) q = q.gte("data_venda", f.dateFrom);
    if (f.dateTo) q = q.lte("data_venda", f.dateTo);
    const { data } = await q;
    let list = (data as unknown as Venda[]) ?? [];
    if (f.atendente && f.atendente !== "all") {
      list = list.filter((v) => v.atendente === f.atendente);
    }
    return list.map((v) => ({ ...v, valor: Number(v.valor) }));
  } catch {
    return [];
  }
}

// ------- Header / footer helpers -------
const BRAND = { r: 11, g: 78, b: 142 }; // institutional blue
const SUB = { r: 90, g: 90, b: 90 };

function drawHeader(doc: jsPDF, logo: string | null, f: ExecutiveFilters, pageNumLabel: string) {
  const pageW = doc.internal.pageSize.getWidth();
  if (logo) {
    try { doc.addImage(logo, "PNG", 40, 28, 60, 28); } catch { /* noop */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("Relatório Executivo Comercial", 110, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(`Laboratório Santé · Período: ${dateRangeLabel(f)}`, 110, 58);

  const now = new Date();
  const ts = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`;
  doc.text(`Gerado em ${ts}`, pageW - 40, 44, { align: "right" });
  doc.text(pageNumLabel, pageW - 40, 58, { align: "right" });

  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1.2);
  doc.line(40, 70, pageW - 40, 70);
  doc.setLineWidth(0.2);
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220);
  doc.line(40, pageH - 36, pageW - 40, pageH - 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Santé · Painel de Orçamentos", 40, pageH - 22);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageW - 40, pageH - 22, { align: "right" });
}

function sectionTitle(doc: jsPDF, y: number, label: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(label.toUpperCase(), 40, y);
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.6);
  doc.line(40, y + 4, 40 + doc.getTextWidth(label.toUpperCase()) + 6, y + 4);
  doc.setLineWidth(0.2);
  doc.setTextColor(20);
  doc.setFont("helvetica", "normal");
  return y + 16;
}

function kpiGrid(
  doc: jsPDF,
  y: number,
  items: { label: string; value: string }[],
  cols = 3,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 10;
  const boxW = (pageW - 80 - gap * (cols - 1)) / cols;
  const boxH = 46;
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 40 + col * (boxW + gap);
    const yy = y + row * (boxH + gap);
    doc.setFillColor(247, 249, 252);
    doc.setDrawColor(220, 228, 238);
    doc.roundedRect(x, yy, boxW, boxH, 5, 5, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(it.label.toUpperCase(), x + 10, yy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(it.value, x + 10, yy + 34);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
  });
  const rows = Math.ceil(items.length / cols);
  return y + rows * (boxH + gap);
}

function paragraph(doc: jsPDF, y: number, text: string, opts?: { size?: number; color?: [number, number, number] }): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(opts?.size ?? 9.5);
  const c = opts?.color ?? [55, 65, 81];
  doc.setTextColor(c[0], c[1], c[2]);
  const lines = doc.splitTextToSize(text, pageW - 80) as string[];
  doc.text(lines, 40, y);
  return y + lines.length * (opts?.size ? opts.size + 3 : 12);
}

// ---------------------------------------------------------------------------

export async function generateExecutiveReport(rows: OrcamentoRow[], filters: ExecutiveFilters) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const logo = await loadLogo();
  const cfg = readCommissionConfig();
  const vendas = await fetchVendas(filters);

  // ===== Datasets =====
  const baseFiltered = applyFilters(rows, filters);
  const uniqOrc = dedupeByOrcamento(baseFiltered);
  const uniqReq = dedupeByRequisicao(baseFiltered);
  const pagosUniq = dedupeByRequisicao(applyFiltersPagos(rows, filters));

  const totalOrcado = uniqOrc.reduce((s, r) => s + r.total, 0);
  const totalReq = uniqReq.reduce((s, r) => s + (r.valorRequisicao || 0), 0);
  const totalPago = pagosUniq.reduce((s, r) => s + r.valorPago, 0);
  const taxaConv = uniqOrc.length ? (pagosUniq.length / uniqOrc.length) * 100 : 0;
  const ticketMedio = pagosUniq.length ? totalPago / pagosUniq.length : 0;
  const atendentesAtivos = new Set(uniqOrc.map((r) => r.usuario)).size;

  // Pendentes: requisições sem pagamento
  const reqsPendentes = uniqReq.filter((r) => !r.pago || (r.valorPago ?? 0) === 0);
  const pendentesCount = reqsPendentes.length;
  const pendentesValor = reqsPendentes.reduce((s, r) => s + (r.valorRequisicao || r.total || 0), 0);
  const taxaPendencia = uniqReq.length ? (pendentesCount / uniqReq.length) * 100 : 0;

  // Vendas (exames/checkup) — totals
  const totalExames = vendas.filter((v) => v.tipo === "exames").reduce((s, v) => s + v.valor, 0);
  const totalCheckup = vendas.filter((v) => v.tipo === "checkup").reduce((s, v) => s + v.valor, 0);
  const comOrc = (totalPago * cfg.pctOrc) / 100;
  const comExames = (totalExames * cfg.pctExames) / 100;
  const comCheckup = (totalCheckup * cfg.pctCheckup) / 100;
  const comTotal = comOrc + comExames + comCheckup;
  const comPctReceita = totalPago ? (comTotal / totalPago) * 100 : 0;

  // By user (full row for page 2)
  const userMap = new Map<string, {
    atendente: string; qtdOrc: number; orcado: number; recebido: number; qtdPago: number;
    exames: number; checkup: number;
  }>();
  uniqOrc.forEach((r) => {
    const e = userMap.get(r.usuario) ?? { atendente: r.usuario, qtdOrc: 0, orcado: 0, recebido: 0, qtdPago: 0, exames: 0, checkup: 0 };
    e.qtdOrc += 1; e.orcado += r.total;
    userMap.set(r.usuario, e);
  });
  pagosUniq.forEach((r) => {
    const e = userMap.get(r.usuario) ?? { atendente: r.usuario, qtdOrc: 0, orcado: 0, recebido: 0, qtdPago: 0, exames: 0, checkup: 0 };
    e.recebido += r.valorPago; e.qtdPago += 1;
    userMap.set(r.usuario, e);
  });
  vendas.forEach((v) => {
    const e = userMap.get(v.atendente) ?? { atendente: v.atendente, qtdOrc: 0, orcado: 0, recebido: 0, qtdPago: 0, exames: 0, checkup: 0 };
    if (v.tipo === "exames") e.exames += v.valor;
    else e.checkup += v.valor;
    userMap.set(v.atendente, e);
  });
  const byUser = [...userMap.values()].sort((a, b) => b.recebido - a.recebido);

  // By convenio
  const convMap = new Map<string, { convenio: string; qtdOrc: number; recebido: number; qtdPago: number; orcado: number }>();
  uniqOrc.forEach((r) => {
    const e = convMap.get(r.convenioPrincipal) ?? { convenio: r.convenioPrincipal, qtdOrc: 0, recebido: 0, qtdPago: 0, orcado: 0 };
    e.qtdOrc += 1; e.orcado += r.total;
    convMap.set(r.convenioPrincipal, e);
  });
  pagosUniq.forEach((r) => {
    const e = convMap.get(r.convenioPrincipal) ?? { convenio: r.convenioPrincipal, qtdOrc: 0, recebido: 0, qtdPago: 0, orcado: 0 };
    e.recebido += r.valorPago; e.qtdPago += 1;
    convMap.set(r.convenioPrincipal, e);
  });
  const byConv = [...convMap.values()].sort((a, b) => b.recebido - a.recebido);
  const top3 = byConv.slice(0, 3);
  const totalConvPago = byConv.reduce((s, c) => s + c.recebido, 0);
  const top2pct = totalConvPago ? (byConv.slice(0, 2).reduce((s, c) => s + c.recebido, 0) / totalConvPago) * 100 : 0;

  // Highlights
  const topUser = byUser[0];
  const topConv = byConv[0];
  const bestConv = byUser.length ? [...byUser].filter((u) => u.qtdOrc > 0).sort((a, b) => (b.qtdPago / b.qtdOrc) - (a.qtdPago / a.qtdOrc))[0] : undefined;
  const bestTicket = byUser.length ? [...byUser].filter((u) => u.qtdPago > 0).sort((a, b) => (b.recebido / b.qtdPago) - (a.recebido / a.qtdPago))[0] : undefined;

  // =====================================================================
  // PAGE 1 — RESUMO EXECUTIVO
  // =====================================================================
  drawHeader(doc, logo, filters, "Página 1 — Resumo Executivo");

  let y = 90;
  y = sectionTitle(doc, y, "Indicadores Gerais");
  y = kpiGrid(doc, y, [
    { label: "Total Orçado", value: fmtBRLFull(totalOrcado) },
    { label: "Total em Requisição", value: fmtBRLFull(totalReq) },
    { label: "Total Recebido", value: fmtBRLFull(totalPago) },
    { label: "Taxa de Conversão", value: `${taxaConv.toFixed(1)}%` },
    { label: "Ticket Médio", value: fmtBRLFull(ticketMedio) },
    { label: "Atendentes Ativos", value: fmtInt(atendentesAtivos) },
  ], 3);

  y += 8;
  y = sectionTitle(doc, y, "Resultado Comercial");
  y = kpiGrid(doc, y, [
    { label: `Comissão de Orçamentos (${cfg.pctOrc}%)`, value: fmtBRLFull(comOrc) },
    { label: `Comissão de Exames (${cfg.pctExames}%)`, value: fmtBRLFull(comExames) },
    { label: `Comissão de Check-up (${cfg.pctCheckup}%)`, value: fmtBRLFull(comCheckup) },
    { label: "Total de Comissões", value: fmtBRLFull(comTotal) },
    { label: "% Comissões sobre Receita", value: `${comPctReceita.toFixed(2)}%` },
    { label: "Custo Comercial do Período", value: fmtBRLFull(comTotal) },
  ], 3);

  y += 8;
  y = sectionTitle(doc, y, "Destaques do Período");
  const destaques = [
    `Atendente com maior faturamento: ${topUser ? `${topUser.atendente} (${fmtBRLFull(topUser.recebido)})` : "—"}`,
    `Convênio com maior faturamento: ${topConv ? `${topConv.convenio} (${fmtBRLFull(topConv.recebido)})` : "—"}`,
    `Melhor taxa de conversão: ${bestConv && bestConv.qtdOrc ? `${bestConv.atendente} (${((bestConv.qtdPago / bestConv.qtdOrc) * 100).toFixed(1)}%)` : "—"}`,
    `Melhor ticket médio: ${bestTicket && bestTicket.qtdPago ? `${bestTicket.atendente} (${fmtBRLFull(bestTicket.recebido / bestTicket.qtdPago)})` : "—"}`,
    `Valor potencial de recuperação: ${fmtBRLFull(pendentesValor)} em ${fmtInt(pendentesCount)} requisição(ões) pendente(s)`,
  ];
  destaques.forEach((d) => { y = paragraph(doc, y, `•  ${d}`); });

  y += 8;
  y = sectionTitle(doc, y, "Parecer Executivo");
  const parecer =
    `O período apresentou faturamento recebido de ${fmtBRLFull(totalPago)} com taxa de conversão de ${taxaConv.toFixed(1)}%. ` +
    (topUser
      ? `A equipe comercial manteve desempenho consistente, liderada por ${topUser.atendente}, responsável pelo maior volume de receita do período (${fmtBRLFull(topUser.recebido)}). `
      : "Não há registro de atendente líder no período. ") +
    `Observa-se concentração de receita nos principais convênios, com os 2 maiores representando ${top2pct.toFixed(1)}% do faturamento total. ` +
    `Foram identificadas ${fmtInt(pendentesCount)} requisições pendentes de pagamento, representando ${fmtBRLFull(pendentesValor)} em potencial de recuperação através da busca ativa. ` +
    `O custo comercial do período totalizou ${fmtBRLFull(comTotal)}, considerando comissões de orçamentos, exames e check-ups.`;
  paragraph(doc, y, parecer);

  // =====================================================================
  // PAGE 2 — PERFORMANCE COMERCIAL DA EQUIPE
  // =====================================================================
  doc.addPage();
  drawHeader(doc, logo, filters, "Página 2 — Performance Comercial da Equipe");

  y = 90;
  y = sectionTitle(doc, y, "Detalhamento por Atendente");

  const userRows = byUser.map((u) => {
    const conv = u.qtdOrc ? (u.qtdPago / u.qtdOrc) * 100 : 0;
    const cOrc = (u.recebido * cfg.pctOrc) / 100;
    const cEx = (u.exames * cfg.pctExames) / 100;
    const cCk = (u.checkup * cfg.pctCheckup) / 100;
    return [
      u.atendente,
      fmtInt(u.qtdOrc),
      fmtBRLFull(u.orcado),
      fmtBRLFull(u.recebido),
      `${conv.toFixed(1)}%`,
      fmtBRLFull(u.exames),
      fmtBRLFull(u.checkup),
      fmtBRLFull(cOrc),
      fmtBRLFull(cEx),
      fmtBRLFull(cCk),
      fmtBRLFull(cOrc + cEx + cCk),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Atendente", "Orç.", "Vl. Orçado", "Recebido", "Conv.", "Exames", "Check-up", "Com. Orç.", "Com. Ex.", "Com. Ck.", "Com. Total"]],
    body: userRows,
    styles: { fontSize: 7.5, cellPadding: 3 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "center" },
      5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error lastAutoTable injected
  y = (doc.lastAutoTable?.finalY ?? y) + 16;

  y = sectionTitle(doc, y, "Indicadores da Equipe");
  const bestComissao = [...byUser].sort((a, b) => {
    const cA = (a.recebido * cfg.pctOrc + a.exames * cfg.pctExames + a.checkup * cfg.pctCheckup) / 100;
    const cB = (b.recebido * cfg.pctOrc + b.exames * cfg.pctExames + b.checkup * cfg.pctCheckup) / 100;
    return cB - cA;
  })[0];
  const comDoBest = bestComissao
    ? (bestComissao.recebido * cfg.pctOrc + bestComissao.exames * cfg.pctExames + bestComissao.checkup * cfg.pctCheckup) / 100
    : 0;
  y = kpiGrid(doc, y, [
    { label: "Maior Faturamento", value: topUser ? `${topUser.atendente}` : "—" },
    { label: "Melhor Conversão", value: bestConv && bestConv.qtdOrc ? `${bestConv.atendente} · ${((bestConv.qtdPago / bestConv.qtdOrc) * 100).toFixed(1)}%` : "—" },
    { label: "Maior Ticket Médio", value: bestTicket && bestTicket.qtdPago ? `${bestTicket.atendente}` : "—" },
    { label: "Maior Comissão", value: bestComissao ? `${bestComissao.atendente} · ${fmtBRLFull(comDoBest)}` : "—" },
  ], 2);

  y += 4;
  y = sectionTitle(doc, y, "Resumo Executivo da Equipe");
  const resumoEquipe =
    `A equipe é composta por ${fmtInt(byUser.length)} atendente(s) com produção registrada no período. ` +
    (topUser ? `${topUser.atendente} liderou em volume recebido (${fmtBRLFull(topUser.recebido)}), ` : "") +
    (bestConv && bestConv.qtdOrc ? `${bestConv.atendente} obteve a melhor taxa de conversão (${((bestConv.qtdPago / bestConv.qtdOrc) * 100).toFixed(1)}%) ` : "") +
    (bestTicket && bestTicket.qtdPago ? `e ${bestTicket.atendente} apresentou o ticket médio mais elevado (${fmtBRLFull(bestTicket.recebido / bestTicket.qtdPago)}). ` : ". ") +
    `A massa de comissões da equipe somou ${fmtBRLFull(comTotal)}, representando ${comPctReceita.toFixed(2)}% do recebido.`;
  paragraph(doc, y, resumoEquipe);

  // =====================================================================
  // PAGE 3 — CONVÊNIOS E OPORTUNIDADES
  // =====================================================================
  doc.addPage();
  drawHeader(doc, logo, filters, "Página 3 — Convênios e Oportunidades");

  y = 90;
  y = sectionTitle(doc, y, "Performance por Convênio");
  const convRows = byConv.slice(0, 20).map((c) => {
    const conv = c.qtdOrc ? (c.qtdPago / c.qtdOrc) * 100 : 0;
    const tk = c.qtdPago ? c.recebido / c.qtdPago : 0;
    return [c.convenio, fmtInt(c.qtdOrc), fmtBRLFull(c.recebido), `${conv.toFixed(1)}%`, fmtBRLFull(tk)];
  });
  autoTable(doc, {
    startY: y,
    head: [["Convênio", "Qtd. Orç.", "Valor Recebido", "Conversão", "Ticket Médio"]],
    body: convRows,
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "center" }, 4: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error lastAutoTable injected
  y = (doc.lastAutoTable?.finalY ?? y) + 14;

  y = sectionTitle(doc, y, "Análise de Concentração");
  const top3Txt = top3.length
    ? top3.map((c, i) => `${i + 1}. ${c.convenio} — ${fmtBRLFull(c.recebido)}`).join("    ")
    : "—";
  y = paragraph(doc, y, `Top 3 convênios: ${top3Txt}`);
  y = paragraph(doc, y, `Participação dos 2 maiores convênios: ${top2pct.toFixed(1)}% do faturamento recebido.`);

  y += 6;
  y = sectionTitle(doc, y, "Busca Ativa");
  y = kpiGrid(doc, y, [
    { label: "Requisições Pendentes", value: fmtInt(pendentesCount) },
    { label: "Valor Potencial de Recuperação", value: fmtBRLFull(pendentesValor) },
    { label: "Conversão Requisição → Pagamento", value: `${(uniqReq.length ? (pagosUniq.length / uniqReq.length) * 100 : 0).toFixed(1)}%` },
    { label: "Taxa de Pendência", value: `${taxaPendencia.toFixed(1)}%` },
  ], 4);

  y += 4;
  y = sectionTitle(doc, y, "Alertas de Gestão");
  const alertas: string[] = [];
  if (top2pct >= 70) alertas.push(`Alta concentração de receita: ${top2pct.toFixed(1)}% vem de apenas 2 convênios. Risco de dependência.`);
  else if (top2pct >= 50) alertas.push(`Concentração moderada: ${top2pct.toFixed(1)}% do faturamento vem dos 2 maiores convênios.`);
  if (taxaPendencia >= 30) alertas.push(`Taxa de pendência elevada: ${taxaPendencia.toFixed(1)}% das requisições ainda não foram pagas.`);
  if (pendentesCount > 0) alertas.push(`${fmtInt(pendentesCount)} requisições pendentes representam ${fmtBRLFull(pendentesValor)} em potencial de recuperação imediata.`);
  const baixos = byConv.filter((c) => totalConvPago && (c.recebido / totalConvPago) * 100 < 2 && c.recebido > 0);
  if (baixos.length >= 3) alertas.push(`${fmtInt(baixos.length)} convênios apresentaram participação inferior a 2% no faturamento.`);
  if (taxaConv < 50 && uniqOrc.length > 0) alertas.push(`Taxa de conversão geral abaixo de 50% (${taxaConv.toFixed(1)}%): há espaço relevante para ações de fechamento.`);
  if (!alertas.length) alertas.push("Nenhum indicador crítico identificado no período analisado.");
  alertas.forEach((a) => { y = paragraph(doc, y, `•  ${a}`); });

  y += 6;
  y = sectionTitle(doc, y, "Conclusão Gerencial");
  const conclusao =
    `O resultado comercial do período totalizou ${fmtBRLFull(totalPago)} recebidos, com taxa de conversão de ${taxaConv.toFixed(1)}% sobre ${fmtInt(uniqOrc.length)} orçamentos gerados. ` +
    `A carteira de convênios mantém ${top2pct.toFixed(1)}% concentrados nos dois principais parceiros, o que reforça a importância de diversificação. ` +
    `A busca ativa apresenta oportunidade direta de ${fmtBRLFull(pendentesValor)} em recuperação, distribuída em ${fmtInt(pendentesCount)} requisições pendentes de pagamento. ` +
    `Recomenda-se priorizar a conversão das pendências, monitorar a concentração por convênio e reforçar as ações de fechamento dos atendentes com menor taxa de conversão.`;
  paragraph(doc, y, conclusao);

  // ===== Footer with page numbers =====
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio-executivo-${stamp}.pdf`);
}