import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Toaster, toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Power, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

type Exame = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
  sinonimos: string | null;
  ativo: boolean;
};

export const Route = createFileRoute("/_authenticated/admin/exames")({
  head: () => ({ meta: [{ title: "Exames · Santé" }] }),
  component: ExamesPage,
});

function ExamesPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Exame[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Exame | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!auth.loading && !auth.isAdmin) navigate({ to: "/" });
  }, [auth.loading, auth.isAdmin, navigate]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("exames").select("*").order("nome");
    if (error) toast.error("Falha", { description: error.message });
    else setRows((data ?? []) as Exame[]);
    setLoading(false);
  };
  useEffect(() => { if (auth.isAdmin) refresh(); }, [auth.isAdmin]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.nome.toLowerCase().includes(s) ||
      r.codigo.toLowerCase().includes(s) ||
      (r.sinonimos ?? "").toLowerCase().includes(s) ||
      (r.categoria ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  const toggleAtivo = async (x: Exame) => {
    const { error } = await supabase.from("exames").update({ ativo: !x.ativo }).eq("id", x.id);
    if (error) return toast.error("Falha", { description: error.message });
    toast.success(!x.ativo ? "Exame ativado" : "Exame inativado");
    refresh();
  };

  const remove = async (x: Exame) => {
    const { count } = await supabase
      .from("vendas")
      .select("id", { count: "exact", head: true })
      .ilike("exames", `%${x.nome}%`);
    if ((count ?? 0) > 0) {
      toast.error("Não é possível excluir", {
        description: `Exame referenciado em ${count} venda(s). Inative em vez de excluir.`,
      });
      return;
    }
    if (!confirm(`Excluir ${x.nome}?`)) return;
    const { error } = await supabase.from("exames").delete().eq("id", x.id);
    if (error) return toast.error("Falha", { description: error.message });
    toast.success("Excluído");
    refresh();
  };

  if (auth.loading || !auth.isAdmin) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-right" richColors />
      <AppHeader active="dashboard" subtitle="Cadastro de exames" />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/admin/users" className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight">Cadastro de exames</h1>
              <p className="text-xs text-muted-foreground">Base usada em vendas, conferência e relatórios.</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo exame
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <div className="mb-4 relative max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, código, sinônimo ou categoria…" className="pl-8" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2 text-left font-medium">Código</th>
                  <th className="py-2 px-2 text-left font-medium">Nome</th>
                  <th className="py-2 px-2 text-left font-medium hidden md:table-cell">Categoria</th>
                  <th className="py-2 px-2 text-left font-medium hidden lg:table-cell">Sinônimos</th>
                  <th className="py-2 px-2 text-left font-medium">Status</th>
                  <th className="py-2 pl-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum exame.</td></tr>
                ) : filtered.map((x) => (
                  <tr key={x.id} className="border-t border-border align-top">
                    <td className="py-2.5 pr-2 font-mono text-xs">{x.codigo}</td>
                    <td className="py-2.5 px-2 font-medium">{x.nome}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">{x.categoria ?? "—"}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden lg:table-cell max-w-xs truncate" title={x.sinonimos ?? ""}>{x.sinonimos ?? "—"}</td>
                    <td className="py-2.5 px-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${x.ativo ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                        {x.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditing(x)} title="Editar" className="rounded-md border border-input bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => toggleAtivo(x)} title={x.ativo ? "Inativar" : "Ativar"} className="rounded-md border border-input bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Power className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(x)} title="Excluir" className="rounded-md border border-input bg-background p-2 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <ExameDialog
        open={creating || !!editing}
        exame={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
      />
    </div>
  );
}

function ExameDialog({ open, exame, onClose, onSaved }: {
  open: boolean; exame: Exame | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ codigo: "", nome: "", categoria: "", sinonimos: "", ativo: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        codigo: exame?.codigo ?? "",
        nome: exame?.nome ?? "",
        categoria: exame?.categoria ?? "",
        sinonimos: exame?.sinonimos ?? "",
        ativo: exame?.ativo ?? true,
      });
    }
  }, [open, exame]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim() || !form.nome.trim()) return toast.error("Código e nome são obrigatórios");
    setBusy(true);
    const payload = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      categoria: form.categoria.trim() || null,
      sinonimos: form.sinonimos.trim() || null,
      ativo: form.ativo,
    };
    try {
      if (exame) {
        const { error } = await supabase.from("exames").update(payload).eq("id", exame.id);
        if (error) throw error;
        toast.success("Atualizado");
      } else {
        const { error } = await supabase.from("exames").insert(payload);
        if (error) throw error;
        toast.success("Cadastrado");
      }
      onSaved();
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{exame ? "Editar exame" : "Novo exame"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label>Categoria</Label>
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label>Sinônimos</Label>
              <Input value={form.sinonimos} onChange={(e) => setForm({ ...form, sinonimos: e.target.value })} placeholder="Separados por vírgula" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativo
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}