import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  OrcamentoRow,
  fmtBRL,
  fmtBRLFull,
  fmtInt,
  monthKey,
  monthLabel,
} from "@/lib/orcamento";
import {
  TrendingUp,
  Users,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Sparkles,
  AlertTriangle,
  Trophy,
  Target,
} from "lucide-react";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary-glow)",
  "var(--primary-deep)",
];

type Props = { rows: OrcamentoRow[]; fileName: string; importedAt: string };

export function Dashboard({ rows, fileName, importedAt }: Props) {
  // Date range bounds (for default values and input limits)
  const dateBounds = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    rows.forEach((r) => {
      if (!r.data) return;
      if (!min || r.data < min) min = r.data;
      if (!max || r.data > max) max = r.data;
    });
    const toISO = (d: Date | null) =>
      d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
    return { minISO: toISO(min), maxISO: toISO(max) };
  }, [rows]);

  const [dateFrom, setDateFrom] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = window.sessionStorage.getItem("periodo.from");
      if (saved) return saved;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = window.sessionStorage.getItem("periodo.to");
      if (saved) return saved;
    }
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  });
  const [convenioFilter, setConvenioFilter] = useState<string>("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("periodo.from", dateFrom);
  }, [dateFrom]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("periodo.to", dateTo);
  }, [dateTo]);

  const conveniosList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.convenioPrincipal));
    return [...set].sort();
  }, [rows]);

  const baseFiltered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    return rows.filter((r) => {
      if (from || to) {
        if (!r.data) return false;
        if (from && r.data < from) return false;
        if (to && r.data > to) return false;
      }
      if (convenioFilter !== "all" && r.convenioPrincipal !== convenioFilter) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo, convenioFilter]);

  const filtered = baseFiltered;

  // KPIs (base totals ignore scope so both numbers are always visible)
  const kpis = useMemo(() => {
    const total = baseFiltered.reduce((s, r) => s + r.total, 0);
    const totalCount = baseFiltered.length;
    const reqValue = baseFiltered.reduce((s, r) => s + r.valorRequisicao, 0);
    const reqCount = baseFiltered.reduce((s, r) => (r.convertido ? s + 1 : s), 0);
    const pagoValue = baseFiltered.reduce((s, r) => s + r.valorPago, 0);
    const pagoCount = baseFiltered.reduce((s, r) => (r.pago ? s + 1 : s), 0);
    const taxaReq = total ? (reqValue / total) * 100 : 0;
    const taxaPago = total ? (pagoValue / total) * 100 : 0;
    const count = filtered.length;
    const scopeTotal = filtered.reduce((s, r) => s + r.total, 0);
    const avg = count ? scopeTotal / count : 0;
    const usuarios = new Set(filtered.map((r) => r.usuario)).size;
    const ticketMedio = totalCount ? total / totalCount : 0;
    const conversaoQtd = totalCount ? (pagoCount / totalCount) * 100 : 0;
    const participacaoPago = total ? (pagoValue / total) * 100 : 0;
    return {
      total, totalCount,
      reqValue, reqCount, taxaReq,
      pagoValue, pagoCount, taxaPago,
      count, avg, usuarios, scopeTotal,
      ticketMedio, conversaoQtd, participacaoPago,
    };
  }, [baseFiltered, filtered]);

  // Monthly trend
  const monthly = useMemo(() => {
    const map = new Map<string, { mes: string; total: number; requisicao: number; pago: number; qtd: number }>();
    rows.forEach((r) => {
      if (!r.data) return;
      const k = monthKey(r.data);
      const e = map.get(k) ?? { mes: k, total: 0, requisicao: 0, pago: 0, qtd: 0 };
      e.total += r.total;
      e.requisicao += r.valorRequisicao;
      e.pago += r.valorPago;
      e.qtd += 1;
      map.set(k, e);
    });
    return [...map.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((e) => ({ ...e, label: monthLabel(e.mes) }));
  }, [rows]);

  // Month-over-month delta (last vs previous)
  const mom = useMemo(() => {
    if (monthly.length < 2) return null;
    const cur = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    const delta = prev.total === 0 ? 0 : ((cur.total - prev.total) / prev.total) * 100;
    return { cur, prev, delta };
  }, [monthly]);

  // By user
  const byUser = useMemo(() => {
    const map = new Map<string, { usuario: string; total: number; qtd: number; pago: number; qtdPago: number }>();
    filtered.forEach((r) => {
      const e = map.get(r.usuario) ?? { usuario: r.usuario, total: 0, qtd: 0, pago: 0, qtdPago: 0 };
      e.total += r.total;
      e.qtd += 1;
      e.pago += r.valorPago;
      if (r.pago) e.qtdPago += 1;
      map.set(r.usuario, e);
    });
    return [...map.values()].sort((a, b) => b.pago - a.pago);
  }, [filtered]);

  // By convenio
  const byConvenio = useMemo(() => {
    const map = new Map<string, { convenio: string; total: number; pago: number; qtd: number; qtdPago: number }>();
    filtered.forEach((r) => {
      const e = map.get(r.convenioPrincipal) ?? {
        convenio: r.convenioPrincipal,
        total: 0,
        pago: 0,
        qtd: 0,
        qtdPago: 0,
      };
      e.total += r.total;
      e.pago += r.valorPago;
      e.qtd += 1;
      if (r.pago) e.qtdPago += 1;
      map.set(r.convenioPrincipal, e);
    });
    return [...map.values()].sort((a, b) => b.pago - a.pago);
  }, [filtered]);

  const topConvenios = byConvenio.slice(0, 6);
  const outrosPago = byConvenio.slice(6).reduce((s, c) => s + c.pago, 0);
  const pieData = outrosPago
    ? [...topConvenios, { convenio: "Outros", total: 0, pago: outrosPago, qtd: 0 }]
    : topConvenios;
  const pieTotalPago = pieData.reduce((s, p) => s + p.pago, 0);

  // Concentration: top 2 convênios share of valor pago
  const concentracao = useMemo(() => {
    const totalPago = byConvenio.reduce((s, c) => s + c.pago, 0);
    const top2 = byConvenio.slice(0, 2);
    const top2Pago = top2.reduce((s, c) => s + c.pago, 0);
    const pct = totalPago ? (top2Pago / totalPago) * 100 : 0;
    return { pct, top2, totalPago };
  }, [byConvenio]);

  // Insights
  const insights = useMemo(() => {
    const list: { icon: "trophy" | "target" | "sparkles"; text: React.ReactNode }[] = [];
    const topUser = [...byUser].sort((a, b) => b.pago - a.pago)[0];
    if (topUser && topUser.pago > 0) {
      list.push({
        icon: "trophy",
        text: <>Atendente com maior valor pago: <strong className="text-foreground">{topUser.usuario}</strong> ({fmtBRLFull(topUser.pago)}).</>,
      });
    }
    const topConv = [...byConvenio].sort((a, b) => b.pago - a.pago)[0];
    if (topConv && topConv.pago > 0) {
      list.push({
        icon: "trophy",
        text: <>Convênio com maior faturamento: <strong className="text-foreground">{topConv.convenio}</strong> ({fmtBRLFull(topConv.pago)}).</>,
      });
    }
    if (monthly.length) {
      const best = [...monthly].sort((a, b) => b.pago - a.pago)[0];
      if (best && best.pago > 0) {
        list.push({
          icon: "sparkles",
          text: <>Melhor mês do período: <strong className="text-foreground">{best.label}</strong> ({fmtBRLFull(best.pago)} pagos).</>,
        });
      }
    }
    if (kpis.ticketMedio > 0) {
      list.push({
        icon: "target",
        text: <>Ticket médio geral: <strong className="text-foreground">{fmtBRLFull(kpis.ticketMedio)}</strong> por orçamento.</>,
      });
    }
    if (concentracao.top2.length >= 2 && concentracao.pct > 0) {
      list.push({
        icon: "target",
        text: <><strong className="text-foreground">{concentracao.pct.toFixed(0)}%</strong> do faturamento está concentrado em <strong className="text-foreground">{concentracao.top2.map((c) => c.convenio).join(" e ")}</strong>.</>,
      });
    }
    return list;
  }, [byUser, byConvenio, monthly, kpis.ticketMedio, concentracao]);

  // Alerts
  const alerts = useMemo(() => {
    const list: { level: "ok" | "warn" | "danger"; text: React.ReactNode }[] = [];
    if (concentracao.pct >= 70 && concentracao.top2.length >= 2) {
      list.push({
        level: "danger",
        text: <>Receita concentrada: <strong>{concentracao.pct.toFixed(0)}%</strong> vem de apenas 2 convênios. Risco de dependência.</>,
      });
    } else if (concentracao.pct >= 50 && concentracao.top2.length >= 2) {
      list.push({
        level: "warn",
        text: <>Concentração moderada: <strong>{concentracao.pct.toFixed(0)}%</strong> do faturamento vem dos 2 maiores convênios.</>,
      });
    } else if (byConvenio.length > 0) {
      list.push({ level: "ok", text: <>Carteira de convênios bem distribuída.</> });
    }

    const semPagto = byUser.filter((u) => u.pago === 0);
    if (semPagto.length > 0) {
      list.push({
        level: "warn",
        text: <><strong>{semPagto.length}</strong> atendente(s) sem pagamentos registrados no período: {semPagto.slice(0, 3).map((u) => u.usuario).join(", ")}{semPagto.length > 3 ? "…" : ""}.</>,
      });
    }

    const totalPago = concentracao.totalPago;
    if (totalPago > 0) {
      const baixos = byConvenio.filter((c) => c.pago > 0 && (c.pago / totalPago) * 100 < 2);
      if (baixos.length >= 3) {
        list.push({
          level: "warn",
          text: <><strong>{baixos.length}</strong> convênios com participação inferior a 2% no faturamento.</>,
        });
      }
    }

    if (mom) {
      if (mom.delta < -10) {
        list.push({
          level: "danger",
          text: <>Queda de <strong>{Math.abs(mom.delta).toFixed(1)}%</strong> no faturamento orçado entre {mom.prev.mes && monthLabel(mom.prev.mes)} e {monthLabel(mom.cur.mes)}.</>,
        });
      } else if (mom.delta > 10) {
        list.push({
          level: "ok",
          text: <>Crescimento de <strong>{mom.delta.toFixed(1)}%</strong> no faturamento orçado vs. mês anterior.</>,
        });
      }
    }
    return list;
  }, [concentracao, byUser, byConvenio, mom]);

  // User x Month stacked
  const userMonthly = useMemo(() => {
    const months = monthly.map((m) => m.mes);
    const topUsers = byUser.slice(0, 5).map((u) => u.usuario);
    return months.map((m) => {
      const row: Record<string, number | string> = { label: monthLabel(m) };
      topUsers.forEach((u) => (row[u] = 0));
      rows.forEach((r) => {
        if (!r.data || monthKey(r.data) !== m) return;
        if (topUsers.includes(r.usuario))
          row[r.usuario] = (row[r.usuario] as number) + r.valorPago;
      });
      return row;
    });
  }, [rows, monthly, byUser]);
  const topUsers = byUser.slice(0, 5).map((u) => u.usuario);

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Período</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                min={dateBounds.minISO || undefined}
                max={dateBounds.maxISO || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="block rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <input
                type="date"
                value={dateTo}
                min={dateBounds.minISO || undefined}
                max={dateBounds.maxISO || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="block rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              Limpar período
            </button>
          )}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Convênio</label>
            <select
              value={convenioFilter}
              onChange={(e) => setConvenioFilter(e.target.value)}
              className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos os convênios</option>
              {conveniosList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div><span className="font-medium text-foreground">{fileName}</span></div>
          <div>Importado em {new Date(importedAt).toLocaleString("pt-BR")}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total orçado"
          value={fmtBRL(kpis.total)}
          hint={`${fmtInt(kpis.totalCount)} orçamentos`}
          accent
          delta={mom ? mom.delta : null}
          info="Soma do valor total (vl_total1) de todos os orçamentos no período/convênio filtrado, independentemente de terem virado requisição ou pagamento."
        />
        <KpiCard
          icon={<Receipt className="h-5 w-5" />}
          label="Em requisição"
          value={fmtBRL(kpis.reqValue)}
          hint={`${fmtInt(kpis.reqCount)} req. · ${kpis.taxaReq.toFixed(1)}% do total`}
          info="Soma do valor_requisicao dos orçamentos que foram convertidos em requisição (viraram venda efetiva no sistema)."
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Recebido"
          value={fmtBRL(kpis.pagoValue)}
          hint={`${fmtInt(kpis.pagoCount)} pagos · ${kpis.taxaPago.toFixed(1)}% do orçado`}
          progress={{ value: kpis.conversaoQtd, label: "Taxa de conversão" }}
          info="Soma do valor_pago — dinheiro efetivamente recebido dos orçamentos pagos pelos clientes."
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Atendentes"
          value={fmtInt(kpis.usuarios)}
          hint={`${fmtInt(kpis.usuarios)} ativo(s) no período`}
          info="Quantidade de atendentes distintos que registraram orçamentos nos filtros selecionados."
        />
      </div>

      {/* Trend area */}
      <Section
        title="Evolução do faturamento"
        subtitle="Total orçado, em requisição e recebido, por mês"
        info="Linha do tempo mensal comparando Total orçado, Requisição (convertidos em venda) e Recebido (efetivamente pago). Use para acompanhar tendência e conversão ao longo dos meses."
      >
        <div className="h-80">
          <ResponsiveContainer>
            <AreaChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-glow)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => fmtBRL(v)} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="total" name="Total orçado" stroke="var(--primary)" strokeWidth={2.5} fill="url(#g1)" />
              <Area type="monotone" dataKey="requisicao" name="Requisição" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#g2)" />
              <Area type="monotone" dataKey="pago" name="Recebido" stroke="var(--chart-3)" strokeWidth={2.5} fill="url(#g3)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By user bar */}
        <Section
          title="Faturamento por atendente"
          subtitle="Ranking por valor recebido"
          info="Ranking dos atendentes pelo valor_pago (dinheiro recebido) dos orçamentos que cada um registrou no período filtrado."
        >
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={byUser} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => fmtBRL(v)} />
                <YAxis dataKey="usuario" type="category" stroke="var(--muted-foreground)" fontSize={12} width={110} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="pago" name="Recebido" radius={[0, 6, 6, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* By convenio donut */}
        <Section
          title="Distribuição por convênio"
          subtitle={
            concentracao.top2.length >= 2 && concentracao.pct > 0
              ? `${concentracao.pct.toFixed(0)}% concentrado em ${concentracao.top2.map((c) => c.convenio).join(" e ")}`
              : "Participação no valor pago"
          }
          info="Participação de cada convênio no valor_pago total. Mostra de onde vem o faturamento efetivamente recebido."
        >
          <div className="grid h-80 grid-cols-1 sm:grid-cols-2">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="pago"
                  nameKey="convenio"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="var(--card)"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center gap-2 overflow-y-auto pr-2 text-sm">
              {pieData.map((p, i) => {
                const pct = pieTotalPago ? (p.pago / pieTotalPago) * 100 : 0;
                return (
                  <div key={p.convenio} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate text-foreground" title={p.convenio}>{p.convenio}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-medium text-foreground">{fmtBRL(p.pago)}</div>
                      <div className="text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      </div>

      {/* Stacked user × month */}
      <Section
        title="Comparativo de atendentes ao longo do tempo"
        subtitle="Top 5 atendentes por valor recebido, por mês"
        info="Evolução mensal dos 5 atendentes com maior valor_pago acumulado. Útil para identificar sazonalidade, crescimento ou queda individual."
      >
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={userMonthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => fmtBRL(v)} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {topUsers.map((u, i) => (
                <Line
                  key={u}
                  type="monotone"
                  dataKey={u}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Detalhe por atendente"
          subtitle={`${byUser.length} pessoas`}
          info="Tabela por atendente com quantidade de orçamentos, total orçado, quantidade de pagos, valor pago e comissão calculada em 2% do valor pago."
        >
          <UserTable rows={byUser} />
        </Section>
        <Section
          title="Detalhe por convênio"
          subtitle={`${byConvenio.length} convênios`}
          info="Tabela por convênio com quantidade de orçamentos, ticket médio (sobre valor pago) e valor pago total."
        >
          <ConvenioTable rows={byConvenio} />
        </Section>
      </div>

      {/* Insights & Alerts (fim da página) */}
      {(insights.length > 0 || alerts.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {insights.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <header className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Insights do período</h3>
                  <p className="text-xs text-muted-foreground">Leitura automática dos dados filtrados</p>
                </div>
              </header>
              <ul className="space-y-2 text-sm">
                {insights.map((it, i) => {
                  const Icon = it.icon === "trophy" ? Trophy : it.icon === "target" ? Target : Sparkles;
                  return (
                    <li key={i} className="flex items-start gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground leading-relaxed">{it.text}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {alerts.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <header className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Alertas de gestão</h3>
                  <p className="text-xs text-muted-foreground">Sinais que merecem atenção</p>
                </div>
              </header>
              <ul className="space-y-2 text-sm">
                {alerts.map((a, i) => {
                  const cls =
                    a.level === "ok"
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                      : a.level === "warn"
                      ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
                      : "border-destructive/40 bg-destructive/5 text-destructive";
                  const dot =
                    a.level === "ok" ? "bg-emerald-500" : a.level === "warn" ? "bg-amber-500" : "bg-destructive";
                  return (
                    <li key={i} className={`flex items-start gap-3 rounded-md border px-3 py-2 ${cls}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                      <span className="leading-relaxed">{a.text}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, info, children }: { title: string; subtitle?: string; info?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {info && <InfoTip text={info} />}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
  delta,
  hint,
  info,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  delta?: number | null;
  hint?: string;
  info?: string;
  progress?: { value: number; label?: string };
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border p-5"
      style={{
        background: accent ? "var(--gradient-primary)" : "var(--card)",
        color: accent ? "var(--primary-foreground)" : undefined,
        boxShadow: accent ? "var(--shadow-elegant)" : "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${accent ? "bg-white/15" : "bg-accent text-primary"}`}>
          {icon}
        </span>
        <div className="flex items-center gap-2">
          {delta != null && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${accent ? "bg-white/15" : delta >= 0 ? "bg-accent text-primary" : "bg-destructive/10 text-destructive"}`}>
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {info && <InfoTip text={info} onAccent={accent} />}
        </div>
      </div>
      <div className={`mt-4 text-xs uppercase tracking-wider ${accent ? "opacity-80" : "text-muted-foreground"}`}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <div className={`mt-1 text-xs ${accent ? "opacity-80" : "text-muted-foreground"}`}>{hint}</div>
      )}
      {progress && (
        <div className="mt-3">
          <div className={`mb-1 flex items-center justify-between text-[11px] ${accent ? "opacity-90" : "text-muted-foreground"}`}>
            <span className="uppercase tracking-wider">{progress.label ?? "Progresso"}</span>
            <span className={`font-semibold ${accent ? "" : "text-foreground"}`}>{progress.value.toFixed(1)}%</span>
          </div>
          <div className={`h-1.5 w-full overflow-hidden rounded-full ${accent ? "bg-white/20" : "bg-accent"}`}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, progress.value))}%`,
                background: accent
                  ? "rgba(255,255,255,0.9)"
                  : "var(--gradient-primary)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTip({ text, onAccent }: { text: string; onAccent?: boolean }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Mais informações"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition ${onAccent ? "text-white/80 hover:bg-white/15 hover:text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function RankTable({
  rows,
  cols,
}: {
  rows: { label: string; total: number; qtd: number; ticket: number }[];
  cols: [string, string, string, string];
}) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2 pr-2 text-left font-medium">{cols[0]}</th>
            <th className="py-2 px-2 text-right font-medium">{cols[1]}</th>
            <th className="py-2 px-2 text-right font-medium">{cols[2]}</th>
            <th className="py-2 pl-2 text-right font-medium">{cols[3]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="py-2 pr-2 text-foreground">{r.label}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtInt(r.qtd)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(r.ticket)}</td>
              <td className="py-2 pl-2 text-right font-medium tabular-nums">{fmtBRL(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserTable({
  rows,
}: {
  rows: { usuario: string; total: number; qtd: number; pago: number; qtdPago: number }[];
}) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2 pr-2 text-left font-medium">Atendente</th>
            <th className="py-2 px-2 text-right font-medium">Orç.</th>
            <th className="py-2 px-2 text-right font-medium">Total</th>
            <th className="py-2 px-2 text-right font-medium">Pagos</th>
            <th className="py-2 px-2 text-right font-medium">Recebido</th>
            <th className="py-2 px-2 text-right font-medium">Ticket médio</th>
            <th className="py-2 px-2 text-right font-medium">Conv. %</th>
            <th className="py-2 pl-2 text-right font-medium">Comissão (2%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const conv = r.qtd ? (r.qtdPago / r.qtd) * 100 : 0;
            const badgeCls =
              conv >= 50
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : conv >= 25
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-destructive/10 text-destructive";
            return (
            <tr key={r.usuario} className="border-t border-border">
              <td className="py-2 pr-2 text-foreground">{r.usuario}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtInt(r.qtd)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(r.total)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtInt(r.qtdPago)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(r.pago)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(r.qtdPago ? r.pago / r.qtdPago : 0)}</td>
              <td className="py-2 px-2 text-right tabular-nums">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
                  {conv.toFixed(1)}%
                </span>
              </td>
              <td className="py-2 pl-2 text-right font-medium tabular-nums text-primary">
                {fmtBRL(r.pago * 0.02)}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConvenioTable({
  rows,
}: {
  rows: { convenio: string; total: number; pago: number; qtd: number; qtdPago: number }[];
}) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2 pr-2 text-left font-medium">Convênio</th>
            <th className="py-2 px-2 text-right font-medium">Orç.</th>
            <th className="py-2 px-2 text-right font-medium">Ticket (recebido)</th>
            <th className="py-2 px-2 text-right font-medium">Recebido</th>
            <th className="py-2 pl-2 text-right font-medium">Conv. %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ticket = r.qtdPago ? r.pago / r.qtdPago : 0;
            const conv = r.qtd ? (r.qtdPago / r.qtd) * 100 : 0;
            const badgeCls =
              conv >= 50
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : conv >= 25
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-destructive/10 text-destructive";
            return (
              <tr key={r.convenio} className="border-t border-border">
                <td className="py-2 pr-2 text-foreground">{r.convenio}</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmtInt(r.qtd)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(ticket)}</td>
                <td className="py-2 px-2 text-right font-medium tabular-nums">{fmtBRL(r.pago)}</td>
                <td className="py-2 pl-2 text-right tabular-nums">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
                    {conv.toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-medium text-foreground">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{fmtBRLFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}