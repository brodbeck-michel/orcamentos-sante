import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { EXAMES_CATALOG, type Exame } from "@/lib/exames-catalog";

const EXAMES: Exame[] = EXAMES_CATALOG;

export function ExamesMultiSelect({
  value,
  onChange,
  placeholder = "Selecione exames…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const byCategory = useMemo(() => {
    const map = new Map<string, Exame[]>();
    EXAMES.forEach((e) => {
      const k = e.categoria || "Outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, []);

  const toggle = (nome: string) => {
    if (value.includes(nome)) onChange(value.filter((v) => v !== nome));
    else onChange([...value, nome]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring",
            )}
          >
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
              {value.length === 0 ? placeholder : `${value.length} exame(s) selecionado(s)`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(520px,90vw)] p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              const s = search.toLowerCase();
              return itemValue.toLowerCase().includes(s) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Buscar exame por nome, sinônimo ou código…" />
            <CommandList className="max-h-72">
              <CommandEmpty>Nenhum exame encontrado.</CommandEmpty>
              {byCategory.map(([cat, items]) => (
                <CommandGroup key={cat} heading={cat}>
                  {items.map((e) => {
                    const selected = value.includes(e.nome);
                    const haystack = `${e.nome} ${e.sinonimos ?? ""} ${e.codigo}`;
                    return (
                      <CommandItem
                        key={e.codigo}
                        value={haystack}
                        onSelect={() => toggle(e.nome)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span className="text-sm">{e.nome}</span>
                          {e.sinonimos && (
                            <span className="text-[11px] text-muted-foreground">{e.sinonimos}</span>
                          )}
                        </div>
                        <span className="ml-auto text-[11px] text-muted-foreground">{e.codigo}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="rounded hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remover ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}