import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Activity, Trash2, LogOut, Users, ClipboardList } from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Dashboard } from "@/components/Dashboard";
import { clearOrcamentos, loadOrcamentos, OrcamentoRow } from "@/lib/orcamento";
import { signOut, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Santé · Painel de Orçamentos" },
      { name: "description", content: "Dashboard de análise dos orçamentos do Laboratório Santé." },
    ],
  }),
  component: Index,
});

function Index() {
  const auth = useAuth();
  const [data, setData] = useState<{ rows: OrcamentoRow[]; fileName: string; importedAt: string } | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = () => setData(loadOrcamentos());
  useEffect(() => {
    refresh();
    setReady(true);
  }, []);

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
              <p className="text-xs text-muted-foreground">Plataforma de Gestão Comercial de Orçamentos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && <UploadDropzone onLoaded={refresh} compact />}
            {data && (
              <button
                onClick={() => {
                  if (confirm("Remover os dados importados?")) {
                    clearOrcamentos();
                    refresh();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                title="Limpar dados"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {auth.isAdmin && (
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent"
              >
                <Users className="h-4 w-4" />
                Usuários
              </Link>
            )}
            <Link
              to="/conferencia"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent"
            >
              <ClipboardList className="h-4 w-4" />
              Conferência
            </Link>
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

      <main className="mx-auto max-w-7xl px-6 py-10">
        {!ready ? null : !data ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                Bem-vindo ao painel de orçamentos
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Importe o relatório mensal exportado do sistema para visualizar
                indicadores por atendente, convênio e evolução no tempo.
              </p>
            </div>
            <UploadDropzone onLoaded={refresh} />
          </div>
        ) : (
          <Dashboard rows={data.rows} fileName={data.fileName} importedAt={data.importedAt} />
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-6 pb-8 pt-4 text-center text-xs text-muted-foreground">
        Fazer melhor o que já se faz bem. · Laboratório Santé
      </footer>
    </div>
  );
}