import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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

export function AtendenteCombobox({
  value,
  onChange,
  suggestions,
  placeholder = "Selecione ou cadastre…",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = (s: string) => s.trim().toLowerCase();
  const trimmedQuery = query.trim();
  const exists = suggestions.some((s) => normalized(s) === normalized(trimmedQuery));

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => { if (!disabled) setOpen(o); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60",
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,90vw)] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput
            placeholder="Buscar atendente…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>
              {trimmedQuery ? (
                <button
                  type="button"
                  onClick={() => pick(trimmedQuery)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-primary hover:bg-accent"
                >
                  <Plus className="h-4 w-4" /> Cadastrar “{trimmedQuery}”
                </button>
              ) : (
                <span className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum atendente.</span>
              )}
            </CommandEmpty>
            <CommandGroup heading="Atendentes">
              {suggestions.map((s) => (
                <CommandItem key={s} value={s} onSelect={() => pick(s)}>
                  <Check className={cn("mr-2 h-4 w-4", value === s ? "opacity-100" : "opacity-0")} />
                  {s}
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmedQuery && !exists && (
              <CommandGroup heading="Novo">
                <CommandItem value={`__new__${trimmedQuery}`} onSelect={() => pick(trimmedQuery)}>
                  <Plus className="mr-2 h-4 w-4 text-primary" />
                  Cadastrar “{trimmedQuery}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}