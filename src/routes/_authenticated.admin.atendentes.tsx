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

type Atendente = { id: string; nome: string; ativo: boolean; created_at: string };

export const Route = createFileRoute("/_authenticated/admin/atendentes")({
  head: () => ({ meta: [{ title: "Atendentes · Santé" }] }),
  component: AtendentesPage,
});

function AtendentesPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Atendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Atendente | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!auth.loading && !auth.isAdmin) navigate({ to: "/" });
  }, [auth.loading, auth.isAdmin, navigate]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("atendentes")
      .select("*")
      .order("nome", { ascending: true });
    if (error) toast.error("Falha ao carregar", { description: error.message });
    else setRows((data ?? []) as Atendente[]);
    setLoading(false);
  };

  useEffect(() => { if (auth.isAdmin) refresh(); }, [auth.isAdmin]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.nome.toLowerCase().includes(s));
  }, [rows, q]);

  const toggleAtivo = async (a: Atendente) => {
    const { error } = await supabase
      .from("atendentes")
      .update({ ativo: !a.ativo })
      .eq("id", a.id);
    if (error) return toast.error("Falha", { description: error.message });
    toast.success(!a.ativo ? "Atendente ativada" : "Atendente inativada");
    refresh();
  };

  const remove = async (a: Atendente) => {
    // Bloqueia exclusão se houver vínculo em vendas ou profiles
    const [{ count: cVendas }, { count: cProfiles }] = await Promise.all([
      supabase.from("vendas").select("id", { count: "exact", head: true }).eq("atendente", a.nome),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("atendente", a.nome),
    ]);
    if ((cVendas ?? 0) > 0 || (cProfiles ?? 0) > 0) {
      toast.error("Não é possível excluir", {
        description: `Atendente vinculada a ${cVendas ?? 0} venda(s) e ${cProfiles ?? 0} usuário(s). Inative em vez de excluir.`,
      });
      return;
    }
    if (!confirm(`Excluir ${a.nome}?`)) return;
    const { error } = await supabase.from("atendentes").delete().eq("id", a.id);
    if (error) return toast.error("Falha", { description: error.message });
    toast.success("Excluída");
    refresh();
  };

  if (auth.loading || !auth.isAdmin) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-right" richColors />
      <AppHeader active="dashboard" subtitle="Cadastro de atendentes" />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/admin/users" className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight">Cadastro de atendentes</h1>
              <p className="text-xs text-muted-foreground">Gerencie as atendentes utilizadas em vendas e relatórios.</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova atendente
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <div className="mb-4 relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome…" className="pl-8" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2 text-left font-medium">Nome</th>
                  <th className="py-2 px-2 text-left font-medium">Status</th>
                  <th className="py-2 pl-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Nenhuma atendente.</td></tr>
                ) : filtered.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="py-2.5 pr-2 font-medium">{a.nome}</td>
                    <td className="py-2.5 px-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${a.ativo ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                        {a.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditing(a)} title="Editar" className="rounded-md border border-input bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => toggleAtivo(a)} title={a.ativo ? "Inativar" : "Ativar"} className="rounded-md border border-input bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Power className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(a)} title="Excluir" className="rounded-md border border-input bg-background p-2 text-destructive hover:bg-destructive/10">
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

      <EditDialog
        open={creating || !!editing}
        atendente={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
      />
    </div>
  );
}

function EditDialog({ open, atendente, onClose, onSaved }: {
  open: boolean; atendente: Atendente | null; onClose: () => void; onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(atendente?.nome ?? "");
      setAtivo(atendente?.ativo ?? true);
    }
  }, [open, atendente]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = nome.trim();
    if (!v) return toast.error("Informe o nome");
    setBusy(true);
    try {
      if (atendente) {
        const { error } = await supabase.from("atendentes").update({ nome: v, ativo }).eq("id", atendente.id);
        if (error) throw error;
        toast.success("Atualizada");
      } else {
        const { error } = await supabase.from("atendentes").insert({ nome: v, ativo });
        if (error) throw error;
        toast.success("Cadastrada");
      }
      onSaved();
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{atendente ? "Editar atendente" : "Nova atendente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativa
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