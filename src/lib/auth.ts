import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "admin" | "user" | "atendente";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: Role | null;
  isAdmin: boolean;
  isAtendente: boolean;
  atendenteName: string | null;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [atendenteName, setAtendenteName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRoleAndProfile = async (uid: string | undefined) => {
      if (!uid) {
        if (active) {
          setRole(null);
          setAtendenteName(null);
        }
        return;
      }
      const [{ data: rolesData }, { data: profileData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("atendente").eq("id", uid).maybeSingle(),
      ]);
      if (!active) return;
      const roles = (rolesData ?? []).map((r) => r.role as Role);
      const resolved: Role | null = roles.includes("admin")
        ? "admin"
        : roles.includes("atendente")
          ? "atendente"
          : roles[0] ?? null;
      setRole(resolved);
      setAtendenteName(((profileData as { atendente?: string | null } | null)?.atendente) ?? null);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTimeout(() => loadRoleAndProfile(s?.user?.id), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadRoleAndProfile(data.session?.user?.id).finally(() => {
        if (active) setLoading(false);
      });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    loading,
    session,
    user: session?.user ?? null,
    role,
    isAdmin: role === "admin",
    isAtendente: role === "atendente",
    atendenteName,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}