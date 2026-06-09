import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Toaster, toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, KeyRound, Plus, Shield, Trash2, User as UserIcon, Headset } from "lucide-react";
import {
  listUsers,
  createUser,
  setUserRole,
  setUserAtendente,
  deleteUser,
  resetPassword,
  type AdminUser,
} from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";

type Role = "admin" | "user" | "atendente";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Usuários · Santé" }] }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const setRoleFn = useServerFn(setUserRole);
  const setAtendenteFn = useServerFn(setUserAtendente);
  const deleteFn = useServerFn(deleteUser);
  const resetFn = useServerFn(resetPassword);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const refresh = async () => {
    try {
      const data = await listFn();
      setUsers(data);
    } catch (e) {
      toast.error("Falha ao listar usuários", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.loading && !auth.isAdmin) navigate({ to: "/" });
  }, [auth.loading, auth.isAdmin, navigate]);

  useEffect(() => {
    if (auth.isAdmin) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAdmin]);

  if (auth.loading || !auth.isAdmin) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-right" richColors />
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Gerenciar usuários
              </h1>
              <p className="text-xs text-muted-foreground">
                Cadastrar, definir papel e remover acessos
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
          >
            <Plus className="h-4 w-4" /> Novo usuário
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {showForm && (
          <CreateUserForm
            onCancel={() => setShowForm(false)}
            onCreated={async () => {
              setShowForm(false);
              await refresh();
            }}
            createFn={createFn}
          />
        )}

        <section className="rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 pl-5 pr-2 text-left font-medium">Usuário</th>
                  <th className="py-3 px-2 text-left font-medium">E-mail</th>
                  <th className="py-3 px-2 text-left font-medium">Papel</th>
                  <th className="py-3 px-2 text-left font-medium">Atendente</th>
                  <th className="py-3 pl-2 pr-5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    u={u}
                    isSelf={u.id === auth.user?.id}
                    onChanged={refresh}
                    setRoleFn={setRoleFn}
                    setAtendenteFn={setAtendenteFn}
                    deleteFn={deleteFn}
                    resetFn={resetFn}
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

function CreateUserForm({
  onCancel,
  onCreated,
  createFn,
}: {
  onCancel: () => void;
  onCreated: () => void;
  createFn: (args: { data: { email: string; password: string; full_name: string; role: Role; atendente?: string | null } }) => Promise<{ id: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "user" as Role,
    atendente: "",
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createFn({
        data: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          atendente: form.atendente.trim() || null,
        },
      });
      toast.success("Usuário criado");
      onCreated();
    } catch (e) {
      toast.error("Falha ao criar usuário", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <h3 className="text-base font-semibold text-foreground">Novo usuário</h3>
      <div className="grid gap-3 sm:grid-cols-2 mt-4">
        <Input label="Nome completo" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
        <Input label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
        <Input label="Senha (mín. 8)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required minLength={8} />
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Papel</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="user">Usuário</option>
            <option value="atendente">Atendente</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <Input
          label="Atendente vinculada (nome exato do orçamento)"
          value={form.atendente}
          onChange={(v) => setForm({ ...form, atendente: v })}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-primary)" }}
        >
          {busy ? "Criando…" : "Criar"}
        </button>
      </div>
    </form>
  );
}

function Input({
  label, value, onChange, type = "text", required, minLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; minLength?: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function UserRow({
  u, isSelf, onChanged, setRoleFn, setAtendenteFn, deleteFn, resetFn,
}: {
  u: AdminUser;
  isSelf: boolean;
  onChanged: () => void;
  setRoleFn: (args: { data: { user_id: string; role: Role } }) => Promise<unknown>;
  setAtendenteFn: (args: { data: { user_id: string; atendente: string | null } }) => Promise<unknown>;
  deleteFn: (args: { data: { user_id: string } }) => Promise<unknown>;
  resetFn: (args: { data: { user_id: string; password: string } }) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [atendDraft, setAtendDraft] = useState(u.atendente ?? "");

  const changeRole = async (role: Role) => {
    if (role === u.role) return;
    setBusy(true);
    try {
      await setRoleFn({ data: { user_id: u.id, role } });
      toast.success("Papel atualizado");
      onChanged();
    } catch (e) {
      toast.error("Falha ao atualizar papel", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const saveAtendente = async () => {
    const next = atendDraft.trim() || null;
    if ((u.atendente ?? null) === next) return;
    setBusy(true);
    try {
      await setAtendenteFn({ data: { user_id: u.id, atendente: next } });
      toast.success("Atendente vinculada");
      onChanged();
    } catch (e) {
      toast.error("Falha ao vincular", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Excluir ${u.email}?`)) return;
    setBusy(true);
    try {
      await deleteFn({ data: { user_id: u.id } });
      toast.success("Usuário excluído");
      onChanged();
    } catch (e) {
      toast.error("Falha ao excluir", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const pwd = prompt("Nova senha (mín. 8 caracteres):");
    if (!pwd) return;
    if (pwd.length < 8) return toast.error("Senha muito curta");
    setBusy(true);
    try {
      await resetFn({ data: { user_id: u.id, password: pwd } });
      toast.success("Senha redefinida");
    } catch (e) {
      toast.error("Falha ao redefinir", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-border">
      <td className="py-3 pl-5 pr-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
            {u.role === "admin" ? <Shield className="h-4 w-4" /> : u.role === "atendente" ? <Headset className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
          </span>
          <div>
            <div className="font-medium text-foreground">{u.full_name ?? "—"}</div>
            {isSelf && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">você</div>}
          </div>
        </div>
      </td>
      <td className="py-3 px-2 text-muted-foreground">{u.email}</td>
      <td className="py-3 px-2">
        <select
          value={u.role}
          disabled={busy || isSelf}
          onChange={(e) => changeRole(e.target.value as Role)}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          <option value="user">Usuário</option>
          <option value="atendente">Atendente</option>
          <option value="admin">Administrador</option>
        </select>
      </td>
      <td className="py-3 px-2">
        <input
          type="text"
          value={atendDraft}
          onChange={(e) => setAtendDraft(e.target.value)}
          onBlur={saveAtendente}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="—"
          className="w-44 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      </td>
      <td className="py-3 pl-2 pr-5 text-right">
        <div className="inline-flex gap-1">
          <button
            onClick={reset}
            disabled={busy}
            title="Redefinir senha"
            className="rounded-md border border-input bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            onClick={remove}
            disabled={busy || isSelf}
            title="Excluir"
            className="rounded-md border border-input bg-background p-2 text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}