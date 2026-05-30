import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-soft)" }}>
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  if (!auth.session) return <LoginScreen />;

  return <Outlet />;
}