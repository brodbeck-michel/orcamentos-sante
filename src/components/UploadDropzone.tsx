import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { parseOrcamentoFile, saveOrcamentos } from "@/lib/orcamento";
import { toast } from "sonner";

export function UploadDropzone({ onLoaded, compact = false }: { onLoaded: () => void; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);

  const handle = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Envie um arquivo .xlsx");
      return;
    }
    setLoading(true);
    try {
      const rows = await parseOrcamentoFile(file);
      if (!rows.length) {
        toast.error("Nenhum orçamento encontrado na planilha.");
        return;
      }
      saveOrcamentos(rows, file.name);
      toast.success(`${rows.length} orçamentos importados`);
      onLoaded();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao ler a planilha.");
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-[var(--primary-deep)] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Nova planilha
        </button>
      </>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handle(f);
      }}
      className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition ${
        drag ? "border-primary bg-accent/40" : "border-border bg-card"
      }`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary">
        {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileSpreadsheet className="h-8 w-8" />}
      </div>
      <h3 className="mt-6 text-xl font-semibold text-foreground">
        {loading ? "Processando…" : "Envie o relatório de orçamentos"}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Arraste o arquivo <span className="font-medium">.xlsx</span> aqui ou clique para selecionar
      </p>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="mt-6 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-60"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Upload className="h-4 w-4" />
        Selecionar planilha
      </button>
      <p className="mt-4 text-xs text-muted-foreground">
        Os dados ficam apenas no seu navegador.
      </p>
    </div>
  );
}