import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Dashboard } from "@/components/Dashboard";
import { clearOrcamentos, loadOrcamentos, OrcamentoRow } from "@/lib/orcamento";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const navigate = useNavigate();
  const [data, setData] = useState<{ rows: OrcamentoRow[]; fileName: string; importedAt: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const refresh = () => setData(loadOrcamentos());
  useEffect(() => {
    refresh();
    setReady(true);
  }, []);

  useEffect(() => {
    if (!auth.loading && auth.isAtendente) navigate({ to: "/vendas", replace: true });
  }, [auth.loading, auth.isAtendente, navigate]);

  if (auth.isAtendente) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-right" richColors />
      <AppHeader
        active="dashboard"
        subtitle="Painel de orçamentos"
        onImport={() => setImportOpen(true)}
        onClearData={
          data
            ? () => {
                if (confirm("Remover os dados importados?")) {
                  clearOrcamentos();
                  refresh();
                }
              }
            : undefined
        }
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar planilha de orçamentos</DialogTitle>
          </DialogHeader>
          <UploadDropzone
            onLoaded={() => {
              refresh();
              setImportOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

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