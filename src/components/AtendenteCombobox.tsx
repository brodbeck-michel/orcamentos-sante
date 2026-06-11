import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
  placeholder = "Selecione…",
  disabled = false,
  allowClear = true,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
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
          <CommandInput placeholder="Buscar atendente…" />
          <CommandList className="max-h-64">
            <CommandEmpty>
              <span className="px-2 py-1.5 text-sm text-muted-foreground">
                Nenhum atendente. Cadastre em <strong>Configurações → Cadastro de atendentes</strong>.
              </span>
            </CommandEmpty>
            <CommandGroup heading="Atendentes">
              {allowClear && value && (
                <CommandItem value="__clear__" onSelect={() => pick("")}>
                  <span className="text-muted-foreground">— Sem vínculo —</span>
                </CommandItem>
              )}
              {suggestions.map((s) => (
                <CommandItem key={s} value={s} onSelect={() => pick(s)}>
                  <Check className={cn("mr-2 h-4 w-4", value === s ? "opacity-100" : "opacity-0")} />
                  {s}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}