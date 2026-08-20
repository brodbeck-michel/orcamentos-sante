import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoSante from "@/assets/logo-sante.png.asset.json";
import { fmtBRLFull } from "@/lib/orcamento";

export type CommissionRow = {
  atendente: string;
  orcPago: number;
  comOrc: number;
  exames: number;
  comExames: number;
  checkup: number;
  comCheckup: number;
  comTotal: number;
};

export type CommissionReportInput = {
  rows: CommissionRow[];
  pctOrc: number;
  pctExames: number;
  pctCheckup: number;
  dateFrom: string;
  dateTo: string;
  convenio: string;
};

const BRAND = { r: 31, g: 107, b: 72 };
const SUB = { r: 90, g: 90, b: 90 };

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

const dateLabel = (iso: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export async function generateCommissionReport(input: CommissionReportInput) {
  const { rows, pctOrc, pctExames, pctCheckup, dateFrom, dateTo, convenio } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();

  // Header
  if (logo) {
    try { doc.addImage(logo, "PNG", 40, 28, 60, 28); } catch { /* noop */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("Relatório de Comissões por Atendente", 110, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(
    `Laboratório Santé · Período: ${dateLabel(dateFrom)} a ${dateLabel(dateTo)}${
      convenio && convenio !== "all" ? ` · Convênio: ${convenio}` : ""
    }`,
    110,
    58,
  );
  const now = new Date();
  doc.text(
    `Gerado em ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`,
    pageW - 40,
    44,
    { align: "right" },
  );
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1.2);
  doc.line(40, 70, pageW - 40, 70);
  doc.setLineWidth(0.2);

  // Percentages applied
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(
    `Percentuais aplicados — Orçamentos: ${pctOrc}%  |  Exames: ${pctExames}%  |  Check-up: ${pctCheckup}%`,
    40,
    90,
  );

  const totals = rows.reduce(
    (acc, r) => {
      acc.orcPago += r.orcPago;
      acc.comOrc += r.comOrc;
      acc.exames += r.exames;
      acc.comExames += r.comExames;
      acc.checkup += r.checkup;
      acc.comCheckup += r.comCheckup;
      acc.comTotal += r.comTotal;
      return acc;
    },
    { orcPago: 0, comOrc: 0, exames: 0, comExames: 0, checkup: 0, comCheckup: 0, comTotal: 0 },
  );

  autoTable(doc, {
    startY: 104,
    head: [[
      "Atendente",
      "Recebido Orç.",
      `Com. Orç.`,
      "Vendas Exames",
      "Com. Exames",
      "Vendas Check-up",
      "Com. Check-up",
      "Comissão Total",
    ]],
    body: rows.map((r) => [
      r.atendente,
      fmtBRLFull(r.orcPago),
      fmtBRLFull(r.comOrc),
      fmtBRLFull(r.exames),
      fmtBRLFull(r.comExames),
      fmtBRLFull(r.checkup),
      fmtBRLFull(r.comCheckup),
      fmtBRLFull(r.comTotal),
    ]),
    foot: [[
      "TOTAL",
      fmtBRLFull(totals.orcPago),
      fmtBRLFull(totals.comOrc),
      fmtBRLFull(totals.exames),
      fmtBRLFull(totals.comExames),
      fmtBRLFull(totals.checkup),
      fmtBRLFull(totals.comCheckup),
      fmtBRLFull(totals.comTotal),
    ]],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [236, 245, 240], textColor: 20, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 249] },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(220);
      doc.line(40, pageH - 36, pageW - 40, pageH - 36);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text("Santé · Relatório de Comissões", 40, pageH - 22);
      doc.text(
        `Página ${doc.getNumberOfPages()}`,
        pageW - 40,
        pageH - 22,
        { align: "right" },
      );
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 140;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(`Comissão total do período: ${fmtBRLFull(totals.comTotal)}`, 40, finalY + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(`${rows.length} atendente(s) no período filtrado.`, 40, finalY + 44);

  doc.save(`comissoes-sante-${dateFrom || "inicio"}-${dateTo || "fim"}.pdf`);
}
