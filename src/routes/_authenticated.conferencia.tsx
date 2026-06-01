import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { Activity, LogOut, Users, LayoutDashboard, ClipboardList, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { loadOrcamentos, OrcamentoRow, fmtBRLFull } from "@/lib/orcamento";
import { signOut, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/conferencia")({
  head: () => ({
    meta: [
      { title: "Santé · Conferência" },
      { name: "description", content: "Conferência de orçamentos do Laboratório Santé." },
    ],
  }),
  component: ConferenciaPage,
});

function ConferenciaPage() {
  const auth = useAuth();
  const [data, setData] = useState<{ rows: OrcamentoRow[]; fileName: string; importedAt: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadOrcamentos());
    setReady(true);
  }, []);

  const rows = data?.rows ?? [];

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  });
  const [usuarioFilter, setUsuarioFilter] = useState<string>("all");
  const [reqFilter, setReqFilter] = useState<"all" | "com" | "sem">("all");
  type SortKey =
    | "orcamento"
    | "data"
    | "paciente"
    | "convenio1"
    | "requisicao"
    | "usuario"
    | "vlTotal1"
    | "valorPago";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (k: SortKey) => {
    if (sortKey !== k) {
      setSortKey(k);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortKey(null);
    }
  };

  const usuariosList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.usuario));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    const result = rows.filter((r) => {
      if (from || to) {
        if (!r.data) return false;
        if (from && r.data < from) return false;
        if (to && r.data > to) return false;
      }
      if (usuarioFilter !== "all" && r.usuario !== usuarioFilter) return false;
      if (reqFilter === "com" && !r.requisicao) return false;
      if (reqFilter === "sem" && r.requisicao) return false;
      return true;
    });
    if (sortKey) {
      const dir = sortDir === "desc" ? -1 : 1;
      result.sort((a, b) => {
        let av: string | number = "";
        let bv: string | number = "";
        if (sortKey === "data") {
          av = a.data ? a.data.getTime() : 0;
          bv = b.data ? b.data.getTime() : 0;
        } else if (sortKey === "vlTotal1" || sortKey === "valorPago") {
          av = a[sortKey] as number;
          bv = b[sortKey] as number;
        } else {
          av = ((a[sortKey] as string | null) ?? "").toString().toLowerCase();
          bv = ((b[sortKey] as string | null) ?? "").toString().toLowerCase();
        }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return result;
  }, [rows, dateFrom, dateTo, usuarioFilter, reqFilter, sortKey, sortDir]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.orcado += r.vlTotal1;
        acc.pago += r.valorPago;
        return acc;
      },
      { orcado: 0, pago: 0 },
    );
  }, [filtered]);

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR") : "—";

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-right" richColors />
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Laboratório Santé
              </h1>
              <p className="text-xs text-muted-foreground">Conferência</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            {auth.isAdmin && (
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent"
              >
                <Users className="h-4 w-4" />
                Usuários
              </Link>
            )}
            <div className="hidden sm:block text-right">
              <div className="text-xs text-muted-foreground">{auth.user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {auth.role ?? "—"}
              </div>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Conferência de Orçamentos</h2>
        </div>

        {!ready ? null : !data ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum dado importado. Volte ao <Link to="/" className="text-primary underline">Dashboard</Link> para importar a planilha.
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">De</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Até</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Usuário</label>
                  <select
                    value={usuarioFilter}
                    onChange={(e) => setUsuarioFilter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">Todos</option>
                    {usuariosList.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Requisição</label>
                  <select
                    value={reqFilter}
                    onChange={(e) => setReqFilter(e.target.value as "all" | "com" | "sem")}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">Todos</option>
                    <option value="com">Com requisição</option>
                    <option value="sem">Sem requisição</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">{filtered.length}</span> registros
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="text-muted-foreground">
                    Total orçado: <span className="font-semibold text-foreground">{fmtBRLFull(totals.orcado)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Total recebido: <span className="font-semibold text-foreground">{fmtBRLFull(totals.pago)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <SortableTh label="Orçamento" k="orcamento" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableTh label="Data" k="data" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableTh label="Paciente" k="paciente" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableTh label="Convênio" k="convenio1" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableTh label="Requisição" k="requisicao" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableTh label="Usuário" k="usuario" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableTh label="Vl. Orçamento" k="vlTotal1" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                      <SortableTh label="Vl. Recebido" k="valorPago" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                          Nenhum registro encontrado.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r, i) => (
                        <tr key={`${r.orcamento}-${i}`} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-xs text-foreground">{r.orcamento}</td>
                          <td className="px-3 py-2 text-foreground">{fmtDate(r.data)}</td>
                          <td className="px-3 py-2 text-foreground">{r.paciente ?? "—"}</td>
                          <td className="px-3 py-2 text-foreground">{r.convenio1 ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs text-foreground">{r.requisicao ?? "—"}</td>
                          <td className="px-3 py-2 text-foreground">{r.usuario}</td>
                          <td className="px-3 py-2 text-right text-foreground">{fmtBRLFull(r.vlTotal1)}</td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">{fmtBRLFull(r.valorPago)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

type SortKey =
  | "orcamento"
  | "data"
  | "paciente"
  | "convenio1"
  | "requisicao"
  | "usuario"
  | "vlTotal1"
  | "valorPago";

function SortableTh({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey | null;
  sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th className={`px-3 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground transition ${
          active ? "text-foreground" : ""
        }`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}