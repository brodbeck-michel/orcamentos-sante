import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { ShoppingBag, Trash2, Percent, Trophy, Receipt, Users as UsersIcon, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtBRLFull } from "@/lib/orcamento";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExamesMultiSelect } from "@/components/ExamesMultiSelect";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Santé · Registro de Vendas" },
      { name: "description", content: "Registro de vendas e relatórios gerenciais." },
    ],
  }),
  component: VendasPage,
});

type Venda = {
  id: string;
  atendente: string;
  data_venda: string; // YYYY-MM-DD
  codigo: string;
  valor: number;
  exames: string;
  tipo: "exames" | "checkup";
  created_by: string;
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const COMMISSION_STORAGE_KEY = "commissionConfig.v1";
const COMMISSION_EVENT = "commission-config-change";
const DEFAULT_PCT = 1.5;

function readCommissionConfig(): { pctExames: number; pctCheckup: number } {
  if (typeof window === "undefined") return { pctExames: DEFAULT_PCT, pctCheckup: DEFAULT_PCT };
  try {
    const raw = window.localStorage.getItem(COMMISSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pctExames: Number.isFinite(parsed?.pctExames) ? Number(parsed.pctExames) : DEFAULT_PCT,
        pctCheckup: Number.isFinite(parsed?.pctCheckup) ? Number(parsed.pctCheckup) : DEFAULT_PCT,
      };
    }
  } catch {
    // ignore
  }
  return { pctExames: DEFAULT_PCT, pctCheckup: DEFAULT_PCT };
}

function writeCommissionConfig(cfg: { pctExames: number; pctCheckup: number }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMMISSION_STORAGE_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent(COMMISSION_EVENT));
  } catch {
    // ignore
  }
}

function VendasPage() {
  const auth = useAuth();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [fAtend, setFAtend] = useState("");
  const [fData, setFData] = useState(todayISO());
  const [fCodigo, setFCodigo] = useState("");
  const [fValor, setFValor] = useState("");
  const [fExames, setFExames] = useState<string[]>([]);
  const [fTipo, setFTipo] = useState<"exames" | "checkup">("exames");
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [filterAtend, setFilterAtend] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Commission config (visual-only, never persisted)
  const initialCommission = readCommissionConfig();
  const [pctExames, setPctExames] = useState<number>(initialCommission.pctExames);
  const [pctCheckup, setPctCheckup] = useState<number>(initialCommission.pctCheckup);

  // Persist commission config (debounced) and notify other views.
  useEffect(() => {
    const current = readCommissionConfig();
    if (current.pctExames === pctExames && current.pctCheckup === pctCheckup) return;
    const t = window.setTimeout(() => {
      writeCommissionConfig({ pctExames, pctCheckup });
      toast.success("Configurações de comissão atualizadas com sucesso.");
    }, 600);
    return () => window.clearTimeout(t);
  }, [pctExames, pctCheckup]);

  // Attendant names from atendentes table (active only)
  const [attendantsDb, setAttendantsDb] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from("atendentes")
      .select("nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setAttendantsDb((data ?? []).map((d) => d.nome)));
  }, []);
  const attendants = useMemo(() => {
    const set = new Set<string>(attendantsDb);
    vendas.forEach((v) => v.atendente && set.add(v.atendente));
    if (auth.atendenteName) set.add(auth.atendenteName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [attendantsDb, vendas, auth.atendenteName]);

  // Prefill / lock atendente when user is "atendente"
  useEffect(() => {
    if (auth.isAtendente && auth.atendenteName && fAtend !== auth.atendenteName) {
      setFAtend(auth.atendenteName);
    }
  }, [auth.isAtendente, auth.atendenteName, fAtend]);

  const fetchVendas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendas")
      .select("*")
      .order("data_venda", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar vendas: " + error.message);
    } else {
      setVendas((data as unknown as Venda[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVendas();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fAtend || !fData || !fCodigo || !fValor || fExames.length === 0 || !fTipo) {
      toast.error("Preencha todos os campos.");
      return;
    }
    const valorNum = parseFloat(fValor.replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("vendas").insert({
      atendente: fAtend,
      data_venda: fData,
      codigo: fCodigo,
      valor: valorNum,
      exames: fExames.join(", "),
      tipo: fTipo,
      created_by: auth.user?.id as string,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Venda registrada!");
    setFCodigo("");
    setFValor("");
    setFExames([]);
    setFData(todayISO());
    fetchVendas();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta venda?")) return;
    const { error } = await supabase.from("vendas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Venda excluída.");
    fetchVendas();
  };

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      if (filterAtend !== "all" && v.atendente !== filterAtend) return false;
      if (filterFrom && v.data_venda < filterFrom) return false;
      if (filterTo && v.data_venda > filterTo) return false;
      return true;
    });
  }, [vendas, filterAtend, filterFrom, filterTo]);

  const totals = useMemo(() => {
    const sum = filtered.reduce((s, v) => s + Number(v.valor), 0);
    return { count: filtered.length, sum };
  }, [filtered]);

  // Charts data
  const barData = useMemo(() => {
    const map = new Map<string, { atendente: string; exames: number; checkup: number }>();
    filtered.forEach((v) => {
      const cur = map.get(v.atendente) ?? { atendente: v.atendente, exames: 0, checkup: 0 };
      cur[v.tipo] += Number(v.valor);
      map.set(v.atendente, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.exames + b.checkup - (a.exames + a.checkup));
  }, [filtered]);

  // Resumo por atendente do PERÍODO FILTRADO (filtered)
  const resumoAtend = useMemo(() => {
    const map = new Map<string, { atendente: string; exames: number; checkup: number }>();
    filtered.forEach((v) => {
      const cur = map.get(v.atendente) ?? { atendente: v.atendente, exames: 0, checkup: 0 };
      cur[v.tipo] += Number(v.valor);
      map.set(v.atendente, cur);
    });
    const list = Array.from(map.values()).map((r) => {
      const comExames = (r.exames * pctExames) / 100;
      const comCheckup = (r.checkup * pctCheckup) / 100;
      const total = r.exames + r.checkup;
      const comTotal = comExames + comCheckup;
      return { ...r, comExames, comCheckup, total, comTotal };
    });
    list.sort((a, b) => b.total - a.total);
    return list;
  }, [filtered, pctExames, pctCheckup]);

  const summary = useMemo(() => {
    const totalPeriodo = filtered.reduce((s, v) => s + Number(v.valor), 0);
    const top = resumoAtend[0];
    const comissaoTotal = resumoAtend.reduce((s, r) => s + r.comTotal, 0);
    return {
      totalPeriodo,
      count: filtered.length,
      topAt: top?.atendente ?? "—",
      topVal: top?.total ?? 0,
      comissaoTotal,
    };
  }, [filtered, resumoAtend]);

  // Bar chart: comissão por atendente
  const comissaoBarData = useMemo(
    () => resumoAtend.map((r) => ({
      atendente: r.atendente,
      comExames: Number(r.comExames.toFixed(2)),
      comCheckup: Number(r.comCheckup.toFixed(2)),
      comTotal: Number(r.comTotal.toFixed(2)),
    })),
    [resumoAtend],
  );

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-right" richColors />
      <AppHeader active="vendas" subtitle="Registro de vendas" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Tabs defaultValue="registro" className="space-y-6">
          <TabsList>
            <TabsTrigger value="registro">Registro</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="space-y-6">
            {/* FORM */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Nova venda</h2>
              <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Atendente</Label>
                  {auth.isAtendente ? (
                    <Input value={fAtend} readOnly disabled placeholder="Não vinculado" />
                  ) : (
                    <Select value={fAtend} onValueChange={setFAtend}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {attendants.length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum atendente — importe orçamentos no painel.</div>
                        )}
                        {attendants.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {auth.isAtendente && !auth.atendenteName && (
                    <p className="text-[11px] text-destructive">Seu usuário ainda não está vinculado a uma atendente. Peça ao administrador.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Data da venda</Label>
                  <Input type="date" value={fData} onChange={(e) => setFData(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Código</Label>
                  <Input inputMode="numeric" value={fCodigo} onChange={(e) => setFCodigo(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1203235" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input className="pl-9" inputMode="decimal" value={fValor} onChange={(e) => setFValor(e.target.value)} placeholder="60,00" required />
                  </div>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Exames</Label>
                  <ExamesMultiSelect value={fExames} onChange={setFExames} />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label>Tipo</Label>
                  <div className="inline-flex rounded-md border border-border p-1">
                    {(["exames", "checkup"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFTipo(opt)}
                        className={`rounded px-4 py-1.5 text-sm transition ${
                          fTipo === opt ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt === "exames" ? "Exames" : "Check-up"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <Button type="submit" disabled={submitting}>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    {submitting ? "Salvando…" : "Registrar venda"}
                  </Button>
                </div>
              </form>
            </section>

            {/* FILTERS + TABLE */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Atendente</Label>
                  <Select value={filterAtend} onValueChange={setFilterAtend}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {attendants.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-[160px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-[160px]" />
                </div>
                {(filterAtend !== "all" || filterFrom || filterTo) && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setFilterAtend("all"); setFilterFrom(""); setFilterTo(""); }}>Limpar</Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atendente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Exames</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma venda registrada.</TableCell></TableRow>
                    ) : (
                      filtered.map((v) => {
                        const canDelete = v.created_by === auth.user?.id || auth.isAdmin;
                        return (
                          <TableRow key={v.id}>
                            <TableCell>{v.atendente}</TableCell>
                            <TableCell>{fmtDate(v.data_venda)}</TableCell>
                            <TableCell>{v.codigo}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtBRLFull(Number(v.valor))}</TableCell>
                            <TableCell>{v.exames}</TableCell>
                            <TableCell>
                              <span className={`rounded-full px-2 py-0.5 text-xs ${v.tipo === "exames" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
                                {v.tipo === "exames" ? "Exames" : "Check-up"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {canDelete && (
                                <button onClick={() => onDelete(v.id)} className="text-muted-foreground hover:text-destructive" title="Excluir">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                  {filtered.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="font-medium">Total: {totals.count} registros</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{fmtBRLFull(totals.sum)}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiBox icon={<Receipt className="h-4 w-4" />} label="Total de Vendas do Período" value={fmtBRLFull(summary.totalPeriodo)} />
              <KpiBox icon={<BarChart3 className="h-4 w-4" />} label="Total de Registros" value={String(summary.count)} />
              <KpiBox icon={<Trophy className="h-4 w-4" />} label="Melhor Atendente" value={summary.topAt} sub={fmtBRLFull(summary.topVal)} />
              <KpiBox icon={<Percent className="h-4 w-4" />} label="Comissão Total" value={fmtBRLFull(summary.comissaoTotal)} />
            </div>

            {/* Filtros aplicados (informativo) */}
            <div className="text-xs text-muted-foreground">
              Os indicadores e tabelas respeitam os filtros aplicados na aba <strong>Registro</strong>
              {(filterAtend !== "all" || filterFrom || filterTo) && (
                <> · <span className="text-foreground">
                  {filterAtend !== "all" && `Atendente: ${filterAtend}`}
                  {filterFrom && ` · De ${fmtDate(filterFrom)}`}
                  {filterTo && ` · Até ${fmtDate(filterTo)}`}
                </span></>
              )}.
            </div>

            {/* Config Comissão */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Configuração de Comissão</h3>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Percentuais usados apenas para cálculo visual dos relatórios. Valores históricos das vendas não são alterados.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 max-w-md">
                <div className="space-y-1.5">
                  <Label className="text-xs">Comissão Exames (%)</Label>
                  <Input type="number" step="0.1" min="0" value={pctExames}
                    onChange={(e) => setPctExames(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Comissão Check-up (%)</Label>
                  <Input type="number" step="0.1" min="0" value={pctCheckup}
                    onChange={(e) => setPctCheckup(Number(e.target.value) || 0)} />
                </div>
              </div>
            </section>

            {/* Resumo por atendente */}
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Resumo por Atendente</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atendente</TableHead>
                      <TableHead className="text-right">Total Exames</TableHead>
                      <TableHead className="text-right">Comissão Exames</TableHead>
                      <TableHead className="text-right">Total Check-up</TableHead>
                      <TableHead className="text-right">Comissão Check-up</TableHead>
                      <TableHead className="text-right">Total Geral</TableHead>
                      <TableHead className="text-right">Comissão Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoAtend.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                    ) : resumoAtend.map((r) => (
                      <TableRow key={r.atendente}>
                        <TableCell className="font-medium">{r.atendente}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRLFull(r.exames)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{fmtBRLFull(r.comExames)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRLFull(r.checkup)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{fmtBRLFull(r.comCheckup)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtBRLFull(r.total)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-primary">{fmtBRLFull(r.comTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {resumoAtend.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-medium">Totais</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtBRLFull(resumoAtend.reduce((s, r) => s + r.exames, 0))}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtBRLFull(resumoAtend.reduce((s, r) => s + r.comExames, 0))}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtBRLFull(resumoAtend.reduce((s, r) => s + r.checkup, 0))}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtBRLFull(resumoAtend.reduce((s, r) => s + r.comCheckup, 0))}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtBRLFull(resumoAtend.reduce((s, r) => s + r.total, 0))}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-primary">{fmtBRLFull(summary.comissaoTotal)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </section>

            {/* Gráfico: Faturamento por Atendente */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold">Faturamento por Atendente</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="atendente" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLFull(Number(v))} width={90} />
                    <Tooltip formatter={(v: number) => fmtBRLFull(Number(v))} />
                    <Legend />
                    <Bar dataKey="exames" name="Exames" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="checkup" name="Check-up" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Gráfico: Comissão por Atendente */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold">Comissão por Atendente</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comissaoBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="atendente" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLFull(Number(v))} width={90} />
                    <Tooltip formatter={(v: number) => fmtBRLFull(Number(v))} />
                    <Legend />
                    <Bar dataKey="comExames" name="Comissão Exames" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="comCheckup" name="Comissão Check-up" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="comTotal" name="Comissão Total" fill="hsl(var(--ring))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function KpiBox({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground truncate" title={value}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}