import * as XLSX from "xlsx";

export type OrcamentoRow = {
  orcamento: string;
  data: Date | null;
  paciente: string | null;
  convenio1: string | null;
  vlTotal1: number;
  convenio2: string | null;
  vlTotal2: number;
  convenio3: string | null;
  vlTotal3: number;
  usuario: string;
  mediaConvenio: number;
  total: number;
  convenioPrincipal: string;
  requisicao: string | null;
  convertido: boolean;
  valorRequisicao: number;
  valorPago: number;
  pago: boolean;
  dataPagamento: Date | null;
};

const toNum = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s.toUpperCase() === "NULL" ? null : s;
};

const excelDate = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return null;
  // Excel serial (days since 1899-12-30)
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
};

export async function parseOrcamentoFile(file: File): Promise<OrcamentoRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  return raw
    .map((r) => {
      const vl1 = toNum(r["VL_TOTAL1"]);
      const vl2 = toNum(r["VL_TOTAL2"]);
      const vl3 = toNum(r["VL_TOTAL3"]);
      const c1 = toStr(r["CONVENIO1"]);
      const c2 = toStr(r["CONVENIO2"]);
      const c3 = toStr(r["CONVENIO3"]);
      const total = vl1 + vl2 + vl3;
      // pick convenio with the highest value as principal, falling back to first available
      const opts = [
        { c: c1, v: vl1 },
        { c: c2, v: vl2 },
        { c: c3, v: vl3 },
      ].filter((o) => o.c);
      opts.sort((a, b) => b.v - a.v);
      const principal = opts[0]?.c ?? "NÃO INFORMADO";
      const requisicao =
        toStr(r["REQUISICAO"]) ??
        toStr(r["REQUISIÇÃO"]) ??
        toStr(r["NR_REQUISICAO"]) ??
        toStr(r["NUM_REQUISICAO"]) ??
        toStr(r["REQUISICOES"]) ??
        null;
      const valorRequisicao = toNum(r["VALOR_REQUISICAO"]);
      const valorPago = toNum(r["Valor_Pago"] ?? r["VALOR_PAGO"] ?? r["valor_pago"]);
      const dataPagamento = excelDate(
        r["DATA_PAGAMENTO"] ??
          r["Data_Pagamento"] ??
          r["data_pagamento"] ??
          r["DT_PAGAMENTO"] ??
          r["DATA PAGAMENTO"]
      );
      return {
        orcamento: String(r["ORCAMENTO"] ?? ""),
        data: excelDate(r["DATA_ORÇAMENTO"]),
        paciente: toStr(r["NM_PACIENTE"]),
        convenio1: c1,
        vlTotal1: vl1,
        convenio2: c2,
        vlTotal2: vl2,
        convenio3: c3,
        vlTotal3: vl3,
        usuario: toStr(r["USUÁRIO"]) ?? toStr(r["USUARIO"]) ?? "NÃO INFORMADO",
        mediaConvenio: toNum(r["MEDIA_CONVENIO"]),
        total: vl1 || total,
        convenioPrincipal: principal,
        requisicao,
        convertido: !!requisicao,
        valorRequisicao,
        valorPago,
        pago: valorPago > 0,
        dataPagamento,
      } as OrcamentoRow;
    })
    .filter((r) => r.orcamento);
}

const STORAGE_KEY = "sante-orcamentos-v1";

export function saveOrcamentos(rows: OrcamentoRow[], fileName: string) {
  const serial = {
    fileName,
    importedAt: new Date().toISOString(),
    rows: rows.map((r) => ({ ...r, data: r.data ? r.data.toISOString() : null })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serial));
}

export function loadOrcamentos(): { rows: OrcamentoRow[]; fileName: string; importedAt: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      rows: parsed.rows.map((r: OrcamentoRow & { data: string | null }) => ({
        ...r,
        data: r.data ? new Date(r.data) : null,
        valorRequisicao: typeof r.valorRequisicao === "number" ? r.valorRequisicao : 0,
        valorPago: typeof r.valorPago === "number" ? r.valorPago : 0,
        pago: typeof r.pago === "boolean" ? r.pago : false,
        dataPagamento:
          (r as unknown as { dataPagamento?: string | null }).dataPagamento
            ? new Date((r as unknown as { dataPagamento: string }).dataPagamento)
            : null,
      })),
    };
  } catch {
    return null;
  }
}

export function clearOrcamentos() {
  localStorage.removeItem(STORAGE_KEY);
}

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const fmtBRLFull = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtInt = (n: number) => n.toLocaleString("pt-BR");

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[parseInt(m) - 1]}/${y.slice(2)}`;
}