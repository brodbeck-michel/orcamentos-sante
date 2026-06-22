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

// Normalize attendant names so vendas + orcamentos consolidate on the same row.
const normName = (s: string | null | undefined) =>
  (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, " ");

// Cap any conversion ratio at 100% for executive display.
const capPct = (n: number) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0);

// Minimum sample size to participate in qualitative rankings.
const MIN_ORC_RANKING = 20;

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

// Calculates the equivalent previous period (same length, immediately before dateFrom).
function previousPeriod(f: ExecutiveFilters): { dateFrom: string; dateTo: string } | null {
  if (!f.dateFrom || !f.dateTo) return null;
  const from = new Date(f.dateFrom + "T00:00:00");
  const to = new Date(f.dateTo + "T00:00:00");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: iso(prevFrom), dateTo: iso(prevTo) };
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

async function fetchVendas(f: { dateFrom: string; dateTo: string; atendente?: string }): Promise<Venda[]> {
  try {
    let q = supabase.from("vendas").select("atendente,data_venda,valor,tipo");
    if (f.dateFrom) q = q.gte("data_venda", f.dateFrom);
    if (f.dateTo) q = q.lte("data_venda", f.dateTo);
    const { data } = await q;
    let list = (data as unknown as Venda[]) ?? [];
    if (f.atendente && f.atendente !== "all") {
      const want = normName(f.atendente);
      list = list.filter((v) => normName(v.atendente) === want);
    }
    return list.map((v) => ({ ...v, valor: Number(v.valor) }));
  } catch {
    return [];
  }
}

// ------- Header / footer helpers -------
// Santé institutional green (matches oklch(0.44 0.11 152) in src/styles.css).
const BRAND = { r: 31, g: 107, b: 72 };
const BRAND_DEEP = { r: 22, g: 78, b: 53 };
const BRAND_SOFT_BG: [number, number, number] = [236, 245, 240];
const BRAND_BORDER: [number, number, number] = [205, 226, 215];
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
    doc.setFillColor(BRAND_SOFT_BG[0], BRAND_SOFT_BG[1], BRAND_SOFT_BG[2]);
    doc.setDrawColor(BRAND_BORDER[0], BRAND_BORDER[1], BRAND_BORDER[2]);
    doc.roundedRect(x, yy, boxW, boxH, 5, 5, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(it.label.toUpperCase(), x + 10, yy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(BRAND_DEEP.r, BRAND_DEEP.g, BRAND_DEEP.b);
    doc.text(it.value, x + 10, yy + 34);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
  });
  const rows = Math.ceil(items.length / cols);
  return y + rows * (boxH + gap);
}

// KPI card with a smaller sub-line under the main value (used for "Destaques").
function kpiGridDetailed(
  doc: jsPDF,
  y: number,
  items: { label: string; value: string; sub?: string; icon?: string }[],
  cols = 4,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 10;
  const boxW = (pageW - 80 - gap * (cols - 1)) / cols;
  const boxH = 70;
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 40 + col * (boxW + gap);
    const yy = y + row * (boxH + gap);
    doc.setFillColor(BRAND_SOFT_BG[0], BRAND_SOFT_BG[1], BRAND_SOFT_BG[2]);
    doc.setDrawColor(BRAND_BORDER[0], BRAND_BORDER[1], BRAND_BORDER[2]);
    doc.roundedRect(x, yy, boxW, boxH, 5, 5, "FD");
    // Top label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(it.label.toUpperCase(), x + 10, yy + 14);
    // Value (truncated to one line)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(BRAND_DEEP.r, BRAND_DEEP.g, BRAND_DEEP.b);
    const valueLines = doc.splitTextToSize(it.value, boxW - 20) as string[];
    doc.text(valueLines[0] ?? "—", x + 10, yy + 36);
    // Sub-line
    if (it.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const subLines = doc.splitTextToSize(it.sub, boxW - 20) as string[];
      doc.text(subLines[0] ?? "", x + 10, yy + 54);
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
  });
  const rows = Math.ceil(items.length / cols);
  return y + rows * (boxH + gap);
}

// Highlighted KPI block (used for the commercial result on page 1).
function kpiBigBlock(
  doc: jsPDF,
  y: number,
  items: {
    label: string;
    value: string;
    sub?: string;
    variation?: { curr: number; prev: number; unit: "rel" | "pp" };
  }[],
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 10;
  const cols = items.length || 1;
  const boxW = (pageW - 80 - gap * (cols - 1)) / cols;
  const boxH = 78;
  items.forEach((it, i) => {
    const x = 40 + i * (boxW + gap);
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.roundedRect(x, y, boxW, boxH, 6, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(it.label.toUpperCase(), x + 12, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(it.value, x + 12, y + 46);
    if (it.variation) {
      // Render badge directly on the dark card using inverted colors.
      const v = it.variation;
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      if (!Number.isFinite(v.prev) || v.prev === 0) {
        doc.setFont("helvetica", "italic");
        doc.text("sem comparativo", x + 12, y + 64);
      } else {
        const delta = v.curr - v.prev;
        const positive = delta > 0.0001;
        const negative = delta < -0.0001;
        const size = 5;
        const ty = y + 64 - 8;
        doc.setFillColor(255, 255, 255);
        if (positive) doc.triangle(x + 12, ty + size, x + 12 + size, ty + size, x + 12 + size / 2, ty, "F");
        else if (negative) doc.triangle(x + 12, ty, x + 12 + size, ty, x + 12 + size / 2, ty + size, "F");
        else doc.rect(x + 12, ty + 1, size, size - 1, "F");
        const sign = positive ? "+" : negative ? "-" : "";
        const txt =
          v.unit === "pp"
            ? `${sign}${Math.abs(delta).toFixed(1)} p.p. vs anterior`
            : `${sign}${Math.abs((delta / Math.abs(v.prev)) * 100).toFixed(1)}% vs anterior`;
        doc.text(txt, x + 12 + size + 5, y + 64);
      }
    } else if (it.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(it.sub, x + 12, y + 64);
    }
    doc.setTextColor(20);
  });
  return y + boxH + 10;
}

function variationLabel(curr: number, prev: number, unit: "money" | "pct" = "money"): string {
  if (!Number.isFinite(prev) || prev === 0) {
    return "sem período anterior comparável";
  }
  const delta = curr - prev;
  const pct = (delta / Math.abs(prev)) * 100;
  const sign = delta >= 0 ? "+" : "-";
  const base = unit === "money" ? fmtBRLFull(Math.abs(delta)) : `${Math.abs(delta).toFixed(1)} p.p.`;
  return `${sign}${Math.abs(pct).toFixed(1)}% (${base}) vs período anterior`;
}

// Variation badge: draws a colored triangle (▲/▼) + signed value.
// `unit`: 'rel' uses relative % change; 'pp' uses absolute delta in p.p.
function drawVarBadge(
  doc: jsPDF,
  x: number,
  baselineY: number,
  curr: number,
  prev: number,
  unit: "rel" | "pp",
) {
  if (!Number.isFinite(prev) || prev === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.text("sem comparativo", x, baselineY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
    return;
  }
  const delta = curr - prev;
  const positive = delta > 0.0001;
  const negative = delta < -0.0001;
  const color: [number, number, number] = positive
    ? [22, 128, 72]
    : negative
      ? [185, 28, 28]
      : [110, 110, 110];
  // Glyph (triangle/square) drawn as vector so it works in any font.
  doc.setFillColor(color[0], color[1], color[2]);
  const size = 5;
  const ty = baselineY - 8;
  if (positive) {
    doc.triangle(x, ty + size, x + size, ty + size, x + size / 2, ty, "F");
  } else if (negative) {
    doc.triangle(x, ty, x + size, ty, x + size / 2, ty + size, "F");
  } else {
    doc.rect(x, ty + 1, size, size - 1, "F");
  }
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const sign = positive ? "+" : negative ? "-" : "";
  const value =
    unit === "pp"
      ? `${sign}${Math.abs(delta).toFixed(1)} p.p.`
      : `${sign}${Math.abs((delta / Math.abs(prev)) * 100).toFixed(1)}%`;
  doc.text(value, x + size + 5, baselineY);
  doc.setTextColor(20);
  doc.setFont("helvetica", "normal");
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

  // Previous period (for executive variation labels only — does NOT change KPIs).
  const prev = previousPeriod(filters);
  const prevFilters: ExecutiveFilters | null = prev
    ? { dateFrom: prev.dateFrom, dateTo: prev.dateTo, convenio: filters.convenio, atendente: filters.atendente }
    : null;
  const prevVendas = prev ? await fetchVendas({ dateFrom: prev.dateFrom, dateTo: prev.dateTo, atendente: filters.atendente }) : [];

  // ===== Datasets =====
  const baseFiltered = applyFilters(rows, filters);
  const uniqOrc = dedupeByOrcamento(baseFiltered);
  const uniqReq = dedupeByRequisicao(baseFiltered);
  const pagosUniq = dedupeByRequisicao(applyFiltersPagos(rows, filters));

  const totalOrcado = uniqOrc.reduce((s, r) => s + r.total, 0);
  const totalReq = uniqReq.reduce((s, r) => s + (r.valorRequisicao || 0), 0);
  const totalPago = pagosUniq.reduce((s, r) => s + r.valorPago, 0);
  const taxaConv = capPct(uniqOrc.length ? (pagosUniq.length / uniqOrc.length) * 100 : 0);
  const ticketMedio = pagosUniq.length ? totalPago / pagosUniq.length : 0;
  const atendentesAtivos = new Set(uniqOrc.map((r) => r.usuario)).size;

  // Previous-period aggregates (used only for variation labels).
  let prevOrcado = 0, prevPago = 0, prevConv = 0;
  if (prevFilters) {
    const pUniqOrc = dedupeByOrcamento(applyFilters(rows, prevFilters));
    const pPagos = dedupeByRequisicao(applyFiltersPagos(rows, prevFilters));
    prevOrcado = pUniqOrc.reduce((s, r) => s + r.total, 0);
    prevPago = pPagos.reduce((s, r) => s + r.valorPago, 0);
    prevConv = capPct(pUniqOrc.length ? (pPagos.length / pUniqOrc.length) * 100 : 0);
  }

  // Pendentes: requisições sem pagamento
  const reqsPendentes = uniqReq.filter((r) => !r.pago || (r.valorPago ?? 0) === 0);
  const pendentesCount = reqsPendentes.length;
  const pendentesValor = reqsPendentes.reduce((s, r) => s + (r.valorRequisicao || r.total || 0), 0);
  const taxaPendencia = capPct(uniqReq.length ? (pendentesCount / uniqReq.length) * 100 : 0);

  // Conversion Requisição → Pagamento: share of THIS period's unique requisições
  // that were actually paid. Uses the same uniqReq base as pendentes for coherence.
  const reqsPagasCount = uniqReq.filter((r) => r.pago && (r.valorPago ?? 0) > 0).length;
  const convReqPag = capPct(uniqReq.length ? (reqsPagasCount / uniqReq.length) * 100 : 0);
  // Sanity check: pendentes + pagas should equal uniqReq. If not, surface a note.
  const reqCoerente = pendentesCount + reqsPagasCount === uniqReq.length;

  // Vendas (exames/checkup) — totals
  const totalExames = vendas.filter((v) => v.tipo === "exames").reduce((s, v) => s + v.valor, 0);
  const totalCheckup = vendas.filter((v) => v.tipo === "checkup").reduce((s, v) => s + v.valor, 0);
  const comOrc = (totalPago * cfg.pctOrc) / 100;
  const comExames = (totalExames * cfg.pctExames) / 100;
  const comCheckup = (totalCheckup * cfg.pctCheckup) / 100;
  const comTotal = comOrc + comExames + comCheckup;
  const comPctReceita = totalPago ? (comTotal / totalPago) * 100 : 0;

  // Previous-period commissions (for variation).
  const prevTotalExames = prevVendas.filter((v) => v.tipo === "exames").reduce((s, v) => s + v.valor, 0);
  const prevTotalCheckup = prevVendas.filter((v) => v.tipo === "checkup").reduce((s, v) => s + v.valor, 0);
  const prevComTotal = (prevPago * cfg.pctOrc + prevTotalExames * cfg.pctExames + prevTotalCheckup * cfg.pctCheckup) / 100;

  // By user (full row for page 2) — keyed by normalized name so vendas consolidate.
  const userMap = new Map<string, {
    atendente: string; qtdOrc: number; orcado: number; recebido: number; qtdPago: number;
    exames: number; checkup: number;
  }>();
  const blank = (atendente: string) => ({ atendente, qtdOrc: 0, orcado: 0, recebido: 0, qtdPago: 0, exames: 0, checkup: 0 });
  uniqOrc.forEach((r) => {
    const k = normName(r.usuario);
    const e = userMap.get(k) ?? blank(r.usuario);
    e.qtdOrc += 1; e.orcado += r.total;
    userMap.set(k, e);
  });
  pagosUniq.forEach((r) => {
    const k = normName(r.usuario);
    const e = userMap.get(k) ?? blank(r.usuario);
    e.recebido += r.valorPago; e.qtdPago += 1;
    userMap.set(k, e);
  });
  vendas.forEach((v) => {
    const k = normName(v.atendente);
    const e = userMap.get(k) ?? blank(v.atendente);
    if (v.tipo === "exames") e.exames += v.valor;
    else e.checkup += v.valor;
    userMap.set(k, e);
  });
  const byUser = [...userMap.values()].sort((a, b) => b.recebido - a.recebido);

  // Qualitative rankings require a minimum sample of orçamentos.
  const eligible = byUser.filter((u) => u.qtdOrc >= MIN_ORC_RANKING);

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

  // Highlights — top revenue uses ALL users (volume-based, no distortion).
  const topUser = byUser[0];
  const topConv = byConv[0];
  // Best conversion / ticket only from atendentes with >= MIN_ORC_RANKING orçamentos.
  const bestConv = eligible.length
    ? [...eligible].sort((a, b) => (b.qtdPago / b.qtdOrc) - (a.qtdPago / a.qtdOrc))[0]
    : undefined;
  const bestTicket = eligible.filter((u) => u.qtdPago > 0).length
    ? [...eligible].filter((u) => u.qtdPago > 0).sort((a, b) => (b.recebido / b.qtdPago) - (a.recebido / a.qtdPago))[0]
    : undefined;

  // =====================================================================
  // PAGE 1 — RESUMO EXECUTIVO
  // =====================================================================
  drawHeader(doc, logo, filters, "Página 1 — Resumo Executivo");

  let y = 90;
  y = sectionTitle(doc, y, "Resultado Comercial do Período");
  y = kpiBigBlock(doc, y, [
    {
      label: "Receita Recebida",
      value: fmtBRLFull(totalPago),
      variation: prevFilters ? { curr: totalPago, prev: prevPago, unit: "rel" } : undefined,
    },
    {
      label: "Total de Comissões",
      value: fmtBRLFull(comTotal),
      variation: prevFilters ? { curr: comTotal, prev: prevComTotal, unit: "rel" } : undefined,
    },
    { label: "Representatividade", value: `${comPctReceita.toFixed(2)}%`, sub: "Comissões sobre Receita" },
  ]);

  y = sectionTitle(doc, y, "Indicadores Gerais");
  y = kpiGrid(doc, y, [
    { label: "Total Orçado", value: fmtBRLFull(totalOrcado) },
    { label: "Total em Requisição", value: fmtBRLFull(totalReq) },
    { label: "Total Recebido", value: fmtBRLFull(totalPago) },
    { label: "Taxa de Conversão", value: `${taxaConv.toFixed(1)}%` },
    { label: "Ticket Médio", value: fmtBRLFull(ticketMedio) },
    { label: "Atendentes Ativos", value: fmtInt(atendentesAtivos) },
  ], 3);

  if (prevFilters) {
    y += 4;
    y = sectionTitle(doc, y, "Comparativo com Período Anterior");
    const compRows: { label: string; atual: string; curr: number; prev: number; unit: "rel" | "pp" }[] = [
      { label: "Total Recebido", atual: fmtBRLFull(totalPago), curr: totalPago, prev: prevPago, unit: "rel" },
      { label: "Total Orçado", atual: fmtBRLFull(totalOrcado), curr: totalOrcado, prev: prevOrcado, unit: "rel" },
      { label: "Total de Comissões", atual: fmtBRLFull(comTotal), curr: comTotal, prev: prevComTotal, unit: "rel" },
      { label: "Taxa de Conversão", atual: `${taxaConv.toFixed(1)}%`, curr: taxaConv, prev: prevConv, unit: "pp" },
    ];
    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Atual", "Variação"]],
      body: compRows.map((r) => [r.label, r.atual, ""]),
      styles: { fontSize: 10, cellPadding: 7 },
      headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND_SOFT_BG },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "right", fontStyle: "bold" },
        2: { halign: "left", cellWidth: 180 },
      },
      margin: { left: 40, right: 40 },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 2) return;
        const row = compRows[data.row.index];
        if (!row) return;
        const baselineY = data.cell.y + data.cell.height / 2 + 3;
        drawVarBadge(doc, data.cell.x + 8, baselineY, row.curr, row.prev, row.unit);
      },
    });
    // @ts-expect-error lastAutoTable injected
    y = (doc.lastAutoTable?.finalY ?? y) + 14;
  }

  y += 4;
  y = sectionTitle(doc, y, "Detalhamento de Comissões");
  y = kpiGrid(doc, y, [
    { label: `Comissão de Orçamentos (${cfg.pctOrc}%)`, value: fmtBRLFull(comOrc) },
    { label: `Comissão de Exames (${cfg.pctExames}%)`, value: fmtBRLFull(comExames) },
    { label: `Comissão de Check-up (${cfg.pctCheckup}%)`, value: fmtBRLFull(comCheckup) },
  ], 3);

  y += 6;
  y = sectionTitle(doc, y, "Destaques do Período");
  y = kpiGridDetailed(doc, y, [
    {
      label: "Melhor Atendente",
      value: topUser ? topUser.atendente : "—",
      sub: topUser ? fmtBRLFull(topUser.recebido) : "Sem dados no período",
    },
    {
      label: "Melhor Convênio",
      value: topConv ? topConv.convenio : "—",
      sub: topConv ? fmtBRLFull(topConv.recebido) : "Sem dados no período",
    },
    {
      label: "Melhor Conversão",
      value: bestConv ? bestConv.atendente : "—",
      sub: bestConv
        ? `${capPct((bestConv.qtdPago / bestConv.qtdOrc) * 100).toFixed(1)}% de conversão`
        : `Mínimo de ${MIN_ORC_RANKING} orçamentos`,
    },
    {
      label: "Potencial de Recuperação",
      value: fmtBRLFull(pendentesValor),
      sub: `${fmtInt(pendentesCount)} requisições pendentes`,
    },
  ], 4);

  y += 6;
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
    const conv = capPct(u.qtdOrc ? (u.qtdPago / u.qtdOrc) * 100 : 0);
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
    alternateRowStyles: { fillColor: BRAND_SOFT_BG },
    columnStyles: {
      1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "center" },
      5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error lastAutoTable injected
  y = (doc.lastAutoTable?.finalY ?? y) + 16;

  y = sectionTitle(doc, y, "Indicadores da Equipe");
  const bestComissao = [...eligible].sort((a, b) => {
    const cA = (a.recebido * cfg.pctOrc + a.exames * cfg.pctExames + a.checkup * cfg.pctCheckup) / 100;
    const cB = (b.recebido * cfg.pctOrc + b.exames * cfg.pctExames + b.checkup * cfg.pctCheckup) / 100;
    return cB - cA;
  })[0];
  const comDoBest = bestComissao
    ? (bestComissao.recebido * cfg.pctOrc + bestComissao.exames * cfg.pctExames + bestComissao.checkup * cfg.pctCheckup) / 100
    : 0;
  y = kpiGrid(doc, y, [
    { label: "Maior Faturamento", value: topUser ? `${topUser.atendente}` : "—" },
    { label: "Melhor Conversão", value: bestConv ? `${bestConv.atendente} · ${capPct((bestConv.qtdPago / bestConv.qtdOrc) * 100).toFixed(1)}%` : "—" },
    { label: "Maior Ticket Médio", value: bestTicket && bestTicket.qtdPago ? `${bestTicket.atendente}` : "—" },
    { label: "Maior Comissão", value: bestComissao ? `${bestComissao.atendente} · ${fmtBRLFull(comDoBest)}` : "—" },
  ], 2);

  y += 4;
  y = sectionTitle(doc, y, "Resumo Executivo da Equipe");
  const resumoEquipe =
    `A equipe é composta por ${fmtInt(byUser.length)} atendente(s) com produção registrada no período, ` +
    `dos quais ${fmtInt(eligible.length)} possuem volume mínimo (${MIN_ORC_RANKING} orçamentos) para participar dos rankings qualitativos. ` +
    (topUser ? `${topUser.atendente} liderou em volume recebido (${fmtBRLFull(topUser.recebido)})` : "") +
    (bestConv ? `, ${bestConv.atendente} obteve a melhor taxa de conversão (${capPct((bestConv.qtdPago / bestConv.qtdOrc) * 100).toFixed(1)}%)` : "") +
    (bestTicket && bestTicket.qtdPago ? ` e ${bestTicket.atendente} apresentou o ticket médio mais elevado (${fmtBRLFull(bestTicket.recebido / bestTicket.qtdPago)}). ` : ". ") +
    `A massa de comissões da equipe somou ${fmtBRLFull(comTotal)}, representando ${comPctReceita.toFixed(2)}% da receita recebida.`;
  paragraph(doc, y, resumoEquipe);

  // =====================================================================
  // PAGE 3 — CONVÊNIOS E DEPENDÊNCIA COMERCIAL
  // =====================================================================
  doc.addPage();
  drawHeader(doc, logo, filters, "Página 3 — Convênios e Dependência Comercial");

  y = 90;
  y = sectionTitle(doc, y, "Performance por Convênio");
  // Hide convênios sem receita recebida no período (ruído visual para a diretoria).
  const byConvComReceita = byConv.filter((c) => (c.recebido ?? 0) > 0);
  const convOcultos = byConv.length - byConvComReceita.length;
  const convRows = byConvComReceita.slice(0, 20).map((c) => {
    const conv = capPct(c.qtdOrc ? (c.qtdPago / c.qtdOrc) * 100 : 0);
    const tk = c.qtdPago ? c.recebido / c.qtdPago : 0;
    const pctRec = totalConvPago ? (c.recebido / totalConvPago) * 100 : 0;
    return [
      c.convenio,
      fmtInt(c.qtdOrc),
      fmtBRLFull(c.recebido),
      `${pctRec.toFixed(1)}%`,
      `${conv.toFixed(1)}%`,
      fmtBRLFull(tk),
    ];
  });
  autoTable(doc, {
    startY: y,
    head: [["Convênio", "Qtd. Orç.", "Valor Recebido", "% Receita", "Conversão", "Ticket Médio"]],
    body: convRows,
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: BRAND_SOFT_BG },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error lastAutoTable injected
  y = (doc.lastAutoTable?.finalY ?? y) + 14;
  // Nota gerencial sob a tabela.
  {
    const note = convOcultos > 0
      ? `Convênios sem receita no período foram ocultados para melhor análise gerencial. (${fmtInt(convOcultos)} ocultado${convOcultos > 1 ? "s" : ""}.)`
      : "Convênios sem receita no período foram ocultados para melhor análise gerencial.";
    y = paragraph(doc, y, note, { size: 8.5, color: [110, 110, 110] });
    y += 4;
  }

  // ----- Análise de Concentração (bloco executivo) -----
  y = sectionTitle(doc, y, "Análise de Concentração de Receita");
  {
    const pageW = doc.internal.pageSize.getWidth();
    const top1 = byConvComReceita[0];
    const top2 = byConvComReceita[1];
    // Card principal (faixa institucional) com semáforo de risco
    const cardH = 78;
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.roundedRect(40, y, pageW - 80, cardH, 6, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.text(`${top2pct.toFixed(1)}%`, 56, y + 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("da receita concentrada nos 2 maiores convênios", 56, y + 64);
    // Semáforo gerencial (Baixa / Moderada / Alta)
    let badge: { text: string; color: [number, number, number] };
    if (top2pct > 70) badge = { text: "ALTA DEPENDÊNCIA COMERCIAL", color: [185, 28, 28] };
    else if (top2pct >= 50) badge = { text: "DEPENDÊNCIA MODERADA", color: [217, 119, 6] };
    else badge = { text: "BAIXA DEPENDÊNCIA", color: [22, 128, 72] };
    doc.setFillColor(badge.color[0], badge.color[1], badge.color[2]);
    const bw = doc.getTextWidth(badge.text) + 18;
    doc.roundedRect(pageW - 40 - bw - 16, y + 22, bw, 22, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(badge.text, pageW - 40 - bw - 16 + 9, y + 37);
    doc.setTextColor(20);
    y += cardH + 10;
    // Dois sub-cards com 1º e 2º convênio
    const subs: { label: string; value: string; sub?: string }[] = [];
    if (top1) subs.push({
      label: "1º Convênio",
      value: top1.convenio,
      sub: `${fmtBRLFull(top1.recebido)} · ${(totalConvPago ? (top1.recebido / totalConvPago) * 100 : 0).toFixed(1)}% da receita`,
    });
    if (top2) subs.push({
      label: "2º Convênio",
      value: top2.convenio,
      sub: `${fmtBRLFull(top2.recebido)} · ${(totalConvPago ? (top2.recebido / totalConvPago) * 100 : 0).toFixed(1)}% da receita`,
    });
    if (subs.length) y = kpiGridDetailed(doc, y, subs, subs.length);
    else y += 4;

    // Recomendação automática conforme nível de dependência
    const recomendacao =
      top2pct > 70
        ? "A carteira apresenta forte dependência dos principais convênios. Recomenda-se ampliar a diversificação comercial e reduzir o risco de concentração."
        : top2pct >= 50
          ? "Há dependência moderada dos principais convênios. Recomenda-se monitorar a evolução e iniciar ações de diversificação preventiva."
          : "A carteira apresenta boa distribuição de receita entre convênios, indicando baixo risco de concentração comercial.";
    y = paragraph(doc, y, recomendacao, { size: 9.5 });
    y += 6;

    // Top 5 Convênios por Receita (ranking visual)
    y = sectionTitle(doc, y, "Top 5 Convênios por Receita");
    const top5 = byConvComReceita.slice(0, 5);
    {
      const rowH = 22;
      top5.forEach((c, i) => {
        const yy = y + i * (rowH + 4);
        doc.setFillColor(BRAND_SOFT_BG[0], BRAND_SOFT_BG[1], BRAND_SOFT_BG[2]);
        doc.setDrawColor(BRAND_BORDER[0], BRAND_BORDER[1], BRAND_BORDER[2]);
        doc.roundedRect(40, yy, pageW - 80, rowH, 3, 3, "FD");
        // Posição (círculo)
        doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
        doc.circle(56, yy + rowH / 2, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${i + 1}`, 56, yy + rowH / 2 + 3, { align: "center" });
        // Nome
        doc.setTextColor(BRAND_DEEP.r, BRAND_DEEP.g, BRAND_DEEP.b);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(c.convenio, 72, yy + rowH / 2 + 3);
        // Valor + % à direita
        const pctR = totalConvPago ? (c.recebido / totalConvPago) * 100 : 0;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(60, 60, 60);
        doc.text(`${fmtBRLFull(c.recebido)}  ·  ${pctR.toFixed(1)}%`, pageW - 56, yy + rowH / 2 + 3, { align: "right" });
      });
      doc.setTextColor(20);
      y += top5.length * (rowH + 4) + 6;
    }

    // Insight executivo dos convênios
    y = sectionTitle(doc, y, "Insight Executivo");
    const insight = top1
      ? `Os dois principais convênios representam ${top2pct.toFixed(1)}% da receita do período, indicando ${top2pct > 70 ? "alta" : top2pct >= 50 ? "moderada" : "baixa"} concentração comercial. O principal convênio foi ${top1.convenio}, responsável por ${(totalConvPago ? (top1.recebido / totalConvPago) * 100 : 0).toFixed(1)}% do faturamento.`
      : "Não há convênios com receita registrada no período.";
    paragraph(doc, y, insight);
  }

  // =====================================================================
  // PAGE 4 — BUSCA ATIVA, ALERTAS E CONCLUSÃO GERENCIAL
  // =====================================================================
  doc.addPage();
  drawHeader(doc, logo, filters, "Página 4 — Busca Ativa, Alertas e Conclusão");

  y = 90;
  // ----- Busca Ativa (bloco principal da página) -----
  y = sectionTitle(doc, y, "Busca Ativa — Potencial de Recuperação");
  {
    const pageW = doc.internal.pageSize.getWidth();
    const pctRecuperacao = totalPago ? (pendentesValor / totalPago) * 100 : 0;
    const cardH = 120;
    doc.setFillColor(BRAND_SOFT_BG[0], BRAND_SOFT_BG[1], BRAND_SOFT_BG[2]);
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setLineWidth(1.4);
    doc.roundedRect(40, y, pageW - 80, cardH, 6, 6, "FD");
    doc.setLineWidth(0.2);
    // Valor de recuperação em destaque (fonte grande, verde institucional)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text("VALOR POTENCIAL DE RECUPERAÇÃO", 56, y + 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.setTextColor(BRAND_DEEP.r, BRAND_DEEP.g, BRAND_DELETED.b);
    doc.text(fmtBRLFull(pendentesValor), 56, y + 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(80, 80, 80);
    doc.text("Receita potencial que ainda pode ser convertida através das ações de busca ativa.", 56, y + 80);
    // Percentual sobre receita recebida
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    const pctLabel = `Representa ${pctRecuperacao.toFixed(1)}% da receita recebida no período.`;
    doc.text(pctLabel, 56, y + 98);
    // Receita recebida de referência
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(`Receita Recebida: ${fmtBRLFull(totalPago)} · ${fmtInt(pendentesCount)} requisições aguardam conversão.`, 56, y + 114);
    // Mini KPIs à direita
    const miniX = pageW / 2 + 30;
    const items = [
      { label: "Requisições Pendentes", value: fmtInt(pendentesCount) },
      { label: "Conv. Requisição -> Pagamento", value: `${convReqPag.toFixed(1)}%` },
      { label: "Taxa de Pendência", value: `${taxaPendencia.toFixed(1)}%` },
      { label: "% sobre Receita", value: `${pctRecuperacao.toFixed(1)}%` },
    ];
    items.forEach((it, i) => {
      const yy = y + 24 + i * 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(it.label.toUpperCase(), miniX, yy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(BRAND_DEEP.r, BRAND_DEEP.g, BRAND_DEEP.b);
      doc.text(it.value, pageW - 56, yy, { align: "right" });
    });
    doc.setTextColor(20);
    y += cardH + 12;
  }
  if (!reqCoerente) {
    y = paragraph(doc, y, `Observacao: divergencia entre requisicoes pagas (${fmtInt(reqsPagasCount)}) e pendentes (${fmtInt(pendentesCount)}) em relacao ao total unico (${fmtInt(uniqReq.length)}). Verificar base de dados.`, { size: 8.5, color: [120, 60, 60] });
  }

  // ----- Alertas Estrategicos (cards coloridos maiores) -----
  y += 6;
  y = sectionTitle(doc, y, "Alertas Estrategicos para a Diretoria");
  type AlertSev = "risk" | "warn" | "opp" | "info";
  const SEV_COLOR: Record<AlertSev, [number, number, number]> = {
    risk: [185, 28, 28],
    warn: [217, 119, 6],
    opp: [22, 128, 72],
    info: [37, 99, 175],
  };
  const SEV_LABEL: Record<AlertSev, string> = {
    risk: "RISCO ALTO",
    warn: "ATENCAO",
    opp: "OPORTUNIDADE",
    info: "INFORMACAO",
  };
  const alertas: { sev: AlertSev; title: string; body: string }[] = [];
  if (top2pct >= 70) alertas.push({ sev: "risk", title: "Concentracao de receita elevada", body: `${top2pct.toFixed(1)}% do faturamento recebido vem dos 2 maiores convenios. Forte dependencia comercial.` });
  else if (top2pct >= 50) alertas.push({ sev: "warn", title: "Concentracao moderada", body: `${top2pct.toFixed(1)}% do faturamento recebido vem dos 2 maiores convenios.` });
  if (prevFilters && prevPago > 0) {
    const varPct = ((totalPago - prevPago) / prevPago) * 100;
    if (varPct <= -10) alertas.push({ sev: "risk", title: "Queda de faturamento", body: `Receita recuou ${Math.abs(varPct).toFixed(1)}% frente ao periodo anterior (${fmtBRLFull(prevPago)} -> ${fmtBRLFull(totalPago)}).` });
    else if (varPct >= 10) alertas.push({ sev: "opp", title: "Crescimento de faturamento", body: `Receita avancou ${varPct.toFixed(1)}% frente ao periodo anterior (${fmtBRLFull(prevPago)} -> ${fmtBRLFull(totalPago)}).` });
  }
  if (prevFilters && prevConv > 0) {
    const dConv = taxaConv - prevConv;
    if (dConv <= -5) alertas.push({ sev: "warn", title: "Queda de conversao", body: `Taxa caiu ${Math.abs(dConv).toFixed(1)} p.p. em relacao ao periodo anterior (${prevConv.toFixed(1)}% -> ${taxaConv.toFixed(1)}%).` });
  }
  if (pendentesValor > 0 && totalPago > 0 && pendentesValor / totalPago >= 0.15) {
    alertas.push({ sev: "opp", title: "Alto potencial de recuperacao", body: `${fmtBRLFull(pendentesValor)} em ${fmtInt(pendentesCount)} requisicoes pendentes (${((pendentesValor / totalPago) * 100).toFixed(1)}% da receita do periodo).` });
  }
  if (taxaPendencia >= 30) alertas.push({ sev: "warn", title: "Pendencias elevadas", body: `${taxaPendencia.toFixed(1)}% das requisicoes ainda nao foram pagas.` });
  if (!alertas.length) alertas.push({ sev: "info", title: "Operacao estavel", body: "Nenhum indicador critico identificado no periodo analisado." });

  {
    const pageW = doc.internal.pageSize.getWidth();
    const cols = 2;
    const gap = 12;
    const boxW = (pageW - 80 - gap * (cols - 1)) / cols;
    const boxH = 72;
    alertas.forEach((a, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 40 + col * (boxW + gap);
      const yy = y + row * (boxH + gap);
      const c = SEV_COLOR[a.sev];
      // Faixa lateral colorida
      doc.setFillColor(c[0], c[1], c[2]);
      doc.roundedRect(x, yy, 5, boxH, 2, 2, "F");
      // Fundo claro
      doc.setFillColor(248, 250, 248);
      doc.setDrawColor(225, 232, 228);
      doc.roundedRect(x + 5, yy, boxW - 5, boxH, 3, 3, "FD");
      // Selo de severidade
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(c[0], c[1], c[2]);
      doc.text(SEV_LABEL[a.sev], x + 14, yy + 16);
      // Título
      doc.setFontSize(10.5);
      doc.setTextColor(BRAND_DEEP.r, BRAND_DEEP.g, BRAND_DEEP.b);
      doc.text(a.title, x + 14, yy + 32);
      // Corpo
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(a.body, boxW - 24) as string[];
      doc.text(lines.slice(0, 3), x + 14, yy + 48);
    });
    doc.setTextColor(20);
    const rows = Math.ceil(alertas.length / cols);
    y += rows * (boxH + gap) + 6;
  }

  // ----- Conclusão Gerencial (bloco destacado) -----
  y = sectionTitle(doc, y, "Conclusão Gerencial");
  {
    const pageW = doc.internal.pageSize.getWidth();
    const conclusao =
      `O resultado comercial do período totalizou ${fmtBRLFull(totalPago)} recebidos, com taxa de conversão de ${taxaConv.toFixed(1)}% sobre ${fmtInt(uniqOrc.length)} orçamentos gerados. ` +
      `A carteira de convênios mantém ${top2pct.toFixed(1)}% concentrados nos dois principais parceiros, o que reforça a importância de diversificação. ` +
      `A busca ativa apresenta oportunidade direta de ${fmtBRLFull(pendentesValor)} em recuperação, distribuída em ${fmtInt(pendentesCount)} requisições pendentes de pagamento. ` +
      `Recomenda-se priorizar a conversão das pendências, monitorar a concentração por convênio e reforçar as ações de fechamento dos atendentes com menor taxa de conversão.`;
    const lines = doc.splitTextToSize(conclusao, pageW - 80 - 36) as string[];
    const padding = 14;
    const boxH = lines.length * 12 + padding * 2 + 8;
    // Fundo levemente destacado + borda verde institucional
    doc.setFillColor(BRAND_SOFT_BG[0], BRAND_SOFT_BG[1], BRAND_SOFT_BG[2]);
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setLineWidth(1.2);
    doc.roundedRect(40, y, pageW - 80, boxH, 6, 6, "FD");
    doc.setLineWidth(0.2);
    // Ícone executivo (selo circular com check)
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.circle(40 + 18, y + 22, 9, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1.4);
    doc.line(40 + 14, y + 22, 40 + 17, y + 25);
    doc.line(40 + 17, y + 25, 40 + 23, y + 18);
    doc.setLineWidth(0.2);
    // Cabeçalho do bloco
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND_DEEP.r, BRAND_DEEP.g, BRAND_DEEP.b);
    doc.text("Encerramento Executivo do Período", 40 + 34, y + 25);
    // Corpo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(55, 65, 81);
    doc.text(lines, 40 + 18, y + 25 + 18);
    doc.setTextColor(20);
    y += boxH + 6;
  }

  // ===== Footer with page numbers =====
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio-executivo-${stamp}.pdf`);
}