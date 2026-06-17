import { Link } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, ClipboardList, ShoppingBag, Settings, Users, Menu, FileSpreadsheet, Headset, FlaskConical, Search } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { signOut, useAuth } from "@/lib/auth";
import logoSante from "@/assets/logo-sante.png.asset.json";

type NavKey = "dashboard" | "conferencia" | "busca-ativa" | "vendas";

const NAV: { key: NavKey; to: "/" | "/conferencia" | "/busca-ativa" | "/vendas"; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", to: "/", label: "Dashboard", Icon: LayoutDashboard },
  { key: "conferencia", to: "/conferencia", label: "Conferência", Icon: ClipboardList },
  { key: "busca-ativa", to: "/busca-ativa", label: "Busca Ativa", Icon: Search },
  { key: "vendas", to: "/vendas", label: "Vendas", Icon: ShoppingBag },
];

export function AppHeader({
  active,
  subtitle,
  onImport,
  onClearData,
}: {
  active: NavKey;
  subtitle?: string;
  onImport?: () => void;
  onClearData?: () => void;
}) {
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showSettings = auth.isAdmin && (onImport || onClearData || true);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img src={logoSante.url} alt="Laboratório Santé" className="h-10 w-10 rounded-lg object-cover" />
          <div className="hidden sm:block leading-tight">
            <div className="text-sm font-semibold tracking-tight text-foreground">Laboratório Santé</div>
            <div className="text-[11px] text-muted-foreground">{subtitle ?? "Gestão Comercial"}</div>
          </div>
        </Link>

        {/* Desktop nav */}
        {!auth.isAtendente && (
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV.map(({ key, to, label, Icon }) => {
              const isActive = key === active;
              return (
                <Link
                  key={key}
                  to={to}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex-1" />

        {/* Right cluster */}
        <div className="flex items-center gap-1.5">
          {showSettings && auth.isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
                title="Configurações"
                aria-label="Configurações"
              >
                <Settings className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {onImport && (
                  <DropdownMenuItem onSelect={() => onImport()}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Importar planilha
                  </DropdownMenuItem>
                )}
                {onClearData && (
                  <DropdownMenuItem onSelect={() => onClearData()}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Limpar dados de orçamento
                  </DropdownMenuItem>
                )}
                {(onImport || onClearData) && <DropdownMenuSeparator />}
                <DropdownMenuItem asChild>
                  <Link to="/admin/users">
                    <Users className="mr-2 h-4 w-4" />
                    Gestão de usuários
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/atendentes">
                    <Headset className="mr-2 h-4 w-4" />
                    Cadastro de atendentes
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/exames">
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Cadastro de exames
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User chip */}
          <div className="hidden lg:flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
            <div className="text-right leading-tight">
              <div className="text-xs text-foreground truncate max-w-[160px]">{auth.user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{auth.role ?? "—"}</div>
            </div>
          </div>

          <button
            onClick={signOut}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>

          {/* Mobile menu */}
          {!auth.isAtendente && (
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Abrir menu"
              >
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="mt-6 flex flex-col gap-1">
                  {NAV.map(({ key, to, label, Icon }) => {
                    const isActive = key === active;
                    return (
                      <Link
                        key={key}
                        to={to}
                        onClick={() => setMobileOpen(false)}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    );
                  })}
                  {auth.isAdmin && (
                    <>
                      <div className="my-2 border-t border-border" />
                      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Configurações</div>
                      {onImport && (
                        <button
                          onClick={() => { setMobileOpen(false); onImport(); }}
                          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <FileSpreadsheet className="h-4 w-4" /> Importar planilha
                        </button>
                      )}
                      {onClearData && (
                        <button
                          onClick={() => { setMobileOpen(false); onClearData(); }}
                          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <FileSpreadsheet className="h-4 w-4" /> Limpar dados
                        </button>
                      )}
                      <Link
                        to="/admin/users"
                        onClick={() => setMobileOpen(false)}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      >
                        <Users className="h-4 w-4" /> Gestão de usuários
                      </Link>
                      <Link
                        to="/admin/atendentes"
                        onClick={() => setMobileOpen(false)}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      >
                        <Headset className="h-4 w-4" /> Cadastro de atendentes
                      </Link>
                      <Link
                        to="/admin/exames"
                        onClick={() => setMobileOpen(false)}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      >
                        <FlaskConical className="h-4 w-4" /> Cadastro de exames
                      </Link>
                    </>
                  )}
                  <div className="my-2 border-t border-border" />
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    <div className="truncate">{auth.user?.email}</div>
                    <div className="text-[10px] uppercase tracking-wider">{auth.role ?? "—"}</div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}