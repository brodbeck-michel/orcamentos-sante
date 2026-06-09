import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { LogOut, LayoutDashboard, ClipboardList, ShoppingBag, Trash2 } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { signOut, useAuth } from "@/lib/auth";
import { loadOrcamentos, fmtBRLFull } from "@/lib/orcamento";
import logoSante from "@/assets/logo-sante.png.asset.json";
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

  // Attendant names from existing orçamentos (localStorage) + previously registered vendas
  const attendants = useMemo(() => {
    const set = new Set<string>();
    const loaded = typeof window !== "undefined" ? loadOrcamentos() : null;
    loaded?.rows.forEach((r) => r.usuario && set.add(r.usuario));
    vendas.forEach((v) => v.atendente && set.add(v.atendente));
    if (auth.atendenteName) set.add(auth.atendenteName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [vendas, auth.atendenteName]);

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

  const lineData = useMemo(() => {
    const map = new Map<string, { data: string; exames: number; checkup: number }>();
    filtered.forEach((v) => {
      const cur = map.get(v.data_venda) ?? { data: v.data_venda, exames: 0, checkup: 0 };
      cur[v.tipo] += Number(v.valor);
      map.set(v.data_venda, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
  }, [filtered]);

  const summary = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const month = vendas.filter((v) => v.data_venda.startsWith(ym));
    const monthSum = month.reduce((s, v) => s + Number(v.valor), 0);
    const byAt = new Map<string, number>();
    month.forEach((v) => byAt.set(v.atendente, (byAt.get(v.atendente) ?? 0) + Number(v.valor)));
    let topAt = "—";
    let topVal = 0;
    byAt.forEach((val, k) => {
      if (val > topVal) {
        topVal = val;
        topAt = k;
      }
    });
    return { monthSum, count: vendas.length, topAt, topVal };
  }, [vendas]);

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-right" richColors />
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoSante.url} alt="Laboratório Santé" className="h-11 w-11 rounded-lg object-cover" />
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">Registro de Vendas</h1>
              <p className="text-xs text-muted-foreground">Lançamento e relatórios de vendas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent">
              <LayoutDashboard className="h-4 w-4" /> Painel
            </Link>
            <Link to="/conferencia" className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent">
              <ClipboardList className="h-4 w-4" /> Conferência
            </Link>
            <div className="hidden sm:block text-right">
              <div className="text-xs text-muted-foreground">{auth.user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{auth.role ?? "—"}</div>
            </div>
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

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
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Total no mês</div>
                <div className="mt-2 text-2xl font-semibold">{fmtBRLFull(summary.monthSum)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Total de registros</div>
                <div className="mt-2 text-2xl font-semibold">{summary.count}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Top atendente (mês)</div>
                <div className="mt-2 text-lg font-semibold">{summary.topAt}</div>
                <div className="text-xs text-muted-foreground">{fmtBRLFull(summary.topVal)}</div>
              </div>
            </div>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold">Valor por atendente (por tipo)</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="atendente" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLFull(Number(v))} width={90} />
                    <Tooltip formatter={(v: number) => fmtBRLFull(Number(v))} />
                    <Legend />
                    <Bar dataKey="exames" name="Exames" stackId="a" fill="hsl(var(--primary))" />
                    <Bar dataKey="checkup" name="Check-up" stackId="a" fill="hsl(var(--accent-foreground))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold">Vendas diárias (R$)</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} tickFormatter={fmtDate} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLFull(Number(v))} width={90} />
                    <Tooltip formatter={(v: number) => fmtBRLFull(Number(v))} labelFormatter={fmtDate} />
                    <Legend />
                    <Line type="monotone" dataKey="exames" name="Exames" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="checkup" name="Check-up" stroke="hsl(var(--accent-foreground))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}