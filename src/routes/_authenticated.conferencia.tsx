import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { Activity, LogOut, Users, LayoutDashboard, ClipboardList, Search } from "lucide-react";
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

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [usuarioFilter, setUsuarioFilter] = useState<string>("all");
  const [convenioFilter, setConvenioFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const usuariosList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.usuario));
    return [...set].sort();
  }, [rows]);

  const conveniosList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.convenio1) set.add(r.convenio1);
    });
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (from || to) {
        if (!r.data) return false;
        if (from && r.data < from) return false;
        if (to && r.data > to) return false;
      }
      if (usuarioFilter !== "all" && r.usuario !== usuarioFilter) return false;
      if (convenioFilter !== "all" && r.convenio1 !== convenioFilter) return false;
      if (q) {
        const blob = `${r.orcamento} ${r.paciente ?? ""} ${r.requisicao ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, dateFrom, dateTo, usuarioFilter, convenioFilter, search]);

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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                  <label className="text-xs text-muted-foreground">Convênio</label>
                  <select
                    value={convenioFilter}
                    onChange={(e) => setConvenioFilter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">Todos</option>
                    {conveniosList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Buscar</label>
                  <div className="relative mt-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Orçamento, paciente, requisição"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm"
                    />
                  </div>
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
                      <th className="px-3 py-3 text-left">Orçamento</th>
                      <th className="px-3 py-3 text-left">Data</th>
                      <th className="px-3 py-3 text-left">Paciente</th>
                      <th className="px-3 py-3 text-left">Convênio</th>
                      <th className="px-3 py-3 text-left">Requisição</th>
                      <th className="px-3 py-3 text-left">Usuário</th>
                      <th className="px-3 py-3 text-right">Vl. Orçamento</th>
                      <th className="px-3 py-3 text-right">Vl. Recebido</th>
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