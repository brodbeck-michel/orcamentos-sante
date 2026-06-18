import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { Search, TrendingUp, AlertCircle, Users as UsersIcon } from "lucide-react";
import { loadOrcamentos, OrcamentoRow, fmtBRLFull, fmtInt, dedupeByRequisicao, maxValorPagoByRequisicao } from "@/lib/orcamento";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated/busca-ativa")({
  head: () => ({
    meta: [
      { title: "Santé · Busca Ativa" },
      { name: "description", content: "Busca ativa de orçamentos pendentes de conversão." },
    ],
  }),
  component: BuscaAtivaPage,
});

type Pendente = OrcamentoRow & { diasAberto: number };

function diasEntre(d: Date): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ref = new Date(d);
  ref.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje.getTime() - ref.getTime()) / 86400000));
}

function badgeForDias(d: number): { label: string; cls: string } {
  if (d <= 7) return { label: `${d}d`, cls: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30" };
  if (d <= 15) return { label: `${d}d`, cls: "bg-amber-500/15 text-amber-600 border border-amber-500/30" };
  if (d <= 30) return { label: `${d}d`, cls: "bg-orange-500/15 text-orange-600 border border-orange-500/30" };
  return { label: `${d}d`, cls: "bg-red-500/15 text-red-600 border border-red-500/30" };
}

function BuscaAtivaPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<{ rows: OrcamentoRow[]; fileName: string; importedAt: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadOrcamentos());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!auth.loading && auth.isAtendente) navigate({ to: "/vendas", replace: true });
  }, [auth.loading, auth.isAtendente, navigate]);

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [convenioFilter, setConvenioFilter] = useState<string>("all");
  const [atendenteFilter, setAtendenteFilter] = useState<string>("all");
  const [faixaFilter, setFaixaFilter] = useState<"all" | "0-7" | "8-15" | "16-30" | "30+">("all");

  if (auth.isAtendente) return null;

  const rows = data?.rows ?? [];

  const pendentesAll: Pendente[] = useMemo(() => {
    // 1 linha por REQUISIÇÃO usando MAX(valor_pago). Pendência = MAX = 0.
    const reqRows = rows.filter((r) => r.requisicao != null && String(r.requisicao).trim() !== "");
    const uniq = dedupeByRequisicao(reqRows);
    const maxMap = maxValorPagoByRequisicao(reqRows);
    return uniq
      .filter((r) => {
        const max = maxMap.get(String(r.requisicao)) ?? 0;
        return max <= 0;
      })
      .map((r) => ({ ...r, diasAberto: r.data ? diasEntre(r.data) : 0 }))
      .sort((a, b) => b.diasAberto - a.diasAberto || b.vlTotal1 - a.vlTotal1);
  }, [rows]);

  const conveniosList = useMemo(
    () => [...new Set(pendentesAll.map((r) => r.convenioPrincipal))].sort(),
    [pendentesAll],
  );
  const atendentesList = useMemo(
    () => [...new Set(pendentesAll.map((r) => r.usuario))].sort(),
    [pendentesAll],
  );

  const pendentes = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    return pendentesAll.filter((r) => {
      if (from && (!r.data || r.data < from)) return false;
      if (to && (!r.data || r.data > to)) return false;
      if (convenioFilter !== "all" && r.convenioPrincipal !== convenioFilter) return false;
      if (atendenteFilter !== "all" && r.usuario !== atendenteFilter) return false;
      if (faixaFilter !== "all") {
        const d = r.diasAberto;
        if (faixaFilter === "0-7" && !(d <= 7)) return false;
        if (faixaFilter === "8-15" && !(d >= 8 && d <= 15)) return false;
        if (faixaFilter === "16-30" && !(d >= 16 && d <= 30)) return false;
        if (faixaFilter === "30+" && !(d > 30)) return false;
      }
      return true;
    });
  }, [pendentesAll, dateFrom, dateTo, convenioFilter, atendenteFilter, faixaFilter]);

  const kpis = useMemo(() => {
    const total = pendentes.length;
    const valor = pendentes.reduce((s, r) => s + (r.vlTotal1 || 0), 0);
    const ticket = total > 0 ? valor / total : 0;
    // Distinct requisições + conversão por MAX(valor_pago) > 0.
    const reqRows = rows.filter((r) => r.requisicao != null && String(r.requisicao).trim() !== "");
    const maxMap = maxValorPagoByRequisicao(reqRows);
    const totalReqs = maxMap.size;
    let convertidos = 0;
    maxMap.forEach((v) => { if (v > 0) convertidos += 1; });
    const conversao = totalReqs > 0 ? (convertidos / totalReqs) * 100 : 0;
    const taxaPendencia = totalReqs > 0 ? ((totalReqs - convertidos) / totalReqs) * 100 : 0;
    return { total, valor, ticket, conversao, taxaPendencia };
  }, [pendentes, rows]);

  const top10 = useMemo(
    () => [...pendentes].sort((a, b) => b.vlTotal1 - a.vlTotal1).slice(0, 10),
    [pendentes],
  );

  const porAtendente = useMemo(() => {
    const map = new Map<string, { qtd: number; valor: number; total: number; convertidos: number }>();
    // 1 entrada por REQUISIÇÃO usando MAX(valor_pago).
    const reqRows = rows.filter((r) => r.requisicao != null && String(r.requisicao).trim() !== "");
    const uniq = dedupeByRequisicao(reqRows);
    const maxMap = maxValorPagoByRequisicao(reqRows);
    uniq.forEach((r) => {
      const k = r.usuario;
      const cur = map.get(k) ?? { qtd: 0, valor: 0, total: 0, convertidos: 0 };
      cur.total += 1;
      if ((maxMap.get(String(r.requisicao)) ?? 0) > 0) cur.convertidos += 1;
      map.set(k, cur);
    });
    pendentes.forEach((r) => {
      const cur = map.get(r.usuario) ?? { qtd: 0, valor: 0, total: 0, convertidos: 0 };
      cur.qtd += 1;
      cur.valor += r.vlTotal1 || 0;
      map.set(r.usuario, cur);
    });
    return [...map.entries()]
      .map(([nome, v]) => ({
        nome,
        qtd: v.qtd,
        valor: v.valor,
        conversao: v.total > 0 ? (v.convertidos / v.total) * 100 : 0,
      }))
      .filter((x) => x.qtd > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [pendentes, rows]);

  const insights = useMemo(() => {
    const list: string[] = [];
    if (pendentes.length === 0) return list;
    list.push(`Existem ${fmtInt(pendentes.length)} requisições pendentes de pagamento.`);
    list.push(`${fmtBRLFull(kpis.valor)} em potencial de recuperação.`);
    const convCount = new Map<string, number>();
    pendentes.forEach((r) => convCount.set(r.convenioPrincipal, (convCount.get(r.convenioPrincipal) ?? 0) + 1));
    const topConv = [...convCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topConv) list.push(`Convênio ${topConv[0]} concentra o maior número de requisições pendentes de pagamento (${topConv[1]}).`);
    const topAt = porAtendente[0];
    if (topAt) list.push(`Atendente ${topAt.nome} possui mais requisições pendentes de pagamento (${topAt.qtd}).`);
    const acima30 = pendentes.filter((r) => r.diasAberto > 30).length;
    if (acima30 > 0) list.push(`${acima30} requisições pendentes de pagamento estão há mais de 30 dias sem conversão.`);
    return list;
  }, [pendentes, kpis, porAtendente]);

  const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-right" richColors />
      <AppHeader active="busca-ativa" subtitle="Busca Ativa de Orçamentos" />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Busca Ativa de Orçamentos</h2>
        </div>

        {!ready ? null : !data ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum dado importado. Volte ao <Link to="/" className="text-primary underline">Dashboard</Link> para importar a planilha.
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard title="Total de Requisições Pendentes de Pagamento" value={fmtInt(kpis.total)} />
              <KpiCard title="Valor Potencial de Recuperação" value={fmtBRLFull(kpis.valor)} />
              <KpiCard title="Ticket Médio Pendente" value={fmtBRLFull(kpis.ticket)} />
              <KpiCard title="Conversão Requisição → Pagamento" value={`${kpis.conversao.toFixed(1)}%`} tooltip="Percentual das requisições geradas que já foram convertidas em faturamento." />
              <KpiCard title="Taxa de Pendência" value={`${kpis.taxaPendencia.toFixed(1)}%`} tooltip="Representa o volume de oportunidades que ainda podem ser recuperadas através da busca ativa." />
            </div>

            {/* Insights */}
            {insights.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Insights de Busca Ativa</h3>
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {insights.map((i, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Filtros */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">De</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Até</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Convênio</label>
                  <select value={convenioFilter} onChange={(e) => setConvenioFilter(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="all">Todos</option>
                    {conveniosList.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Atendente</label>
                  <select value={atendenteFilter} onChange={(e) => setAtendenteFilter(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="all">Todos</option>
                    {atendentesList.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Dias em aberto</label>
                  <select value={faixaFilter} onChange={(e) => setFaixaFilter(e.target.value as typeof faixaFilter)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="all">Todas</option>
                    <option value="0-7">0 a 7 dias</option>
                    <option value="8-15">8 a 15 dias</option>
                    <option value="16-30">16 a 30 dias</option>
                    <option value="30+">Acima de 30 dias</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Tabela */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Requisições Pendentes de Pagamento</h3>
                  <span className="text-xs text-muted-foreground">{pendentes.length} registros</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 text-left">Requisição</th>
                        <th className="px-3 py-3 text-left">Data</th>
                        <th className="px-3 py-3 text-left">Paciente</th>
                        <th className="px-3 py-3 text-left hidden md:table-cell">Convênio</th>
                        <th className="px-3 py-3 text-left hidden md:table-cell">Atendente</th>
                        <th className="px-3 py-3 text-right">Vl. Orçado</th>
                        <th className="px-3 py-3 text-center">Dias</th>
                        <th className="px-3 py-3 text-left hidden lg:table-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pendentes.length === 0 ? (
                        <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhuma requisição pendente de pagamento encontrada.</td></tr>
                      ) : pendentes.map((r, i) => {
                        const b = badgeForDias(r.diasAberto);
                        return (
                          <tr key={`${r.orcamento}-${i}`} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-foreground">{r.requisicao ?? "—"}</td>
                            <td className="px-3 py-2 text-foreground">{fmtDate(r.data)}</td>
                            <td className="px-3 py-2 text-foreground">{r.paciente ?? "—"}</td>
                            <td className="px-3 py-2 text-foreground hidden md:table-cell">{r.convenioPrincipal}</td>
                            <td className="px-3 py-2 text-foreground hidden md:table-cell">{r.usuario}</td>
                            <td className="px-3 py-2 text-right text-foreground">{fmtBRLFull(r.vlTotal1)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
                            </td>
                            <td className="px-3 py-2 hidden lg:table-cell">
                              <span className="inline-flex rounded-md bg-amber-500/10 text-amber-700 px-2 py-0.5 text-xs whitespace-nowrap">Requisição Pendente de Pagamento</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top 10 */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Top 10 Oportunidades</h3>
                </div>
                <ul className="divide-y divide-border">
                  {top10.length === 0 ? (
                    <li className="p-4 text-center text-sm text-muted-foreground">Sem requisições pendentes de pagamento.</li>
                  ) : top10.map((r, i) => (
                    <li key={`${r.orcamento}-${i}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{r.paciente ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.convenioPrincipal} · {r.usuario}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-foreground">{fmtBRLFull(r.vlTotal1)}</div>
                        <div className="text-[10px] text-muted-foreground">{r.diasAberto}d em aberto</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Por Atendente */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Indicadores por Atendente</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 text-left">Atendente</th>
                      <th className="px-3 py-3 text-right">Requisições Pendentes de Pagamento</th>
                      <th className="px-3 py-3 text-right">Valor Pendente</th>
                      <th className="px-3 py-3 text-right">Conversão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {porAtendente.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Sem dados.</td></tr>
                    ) : porAtendente.map((a) => (
                      <tr key={a.nome} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-foreground">{a.nome}</td>
                        <td className="px-3 py-2 text-right text-foreground">{fmtInt(a.qtd)}</td>
                        <td className="px-3 py-2 text-right text-foreground">{fmtBRLFull(a.valor)}</td>
                        <td className="px-3 py-2 text-right text-foreground">{a.conversao.toFixed(1)}%</td>
                      </tr>
                    ))}
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

function KpiCard({ title, value, tooltip }: { title: string; value: string; tooltip?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4" title={tooltip}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}