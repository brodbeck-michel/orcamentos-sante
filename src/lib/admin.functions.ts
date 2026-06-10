import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "user" | "atendente";
  atendente: string | null;
  created_at: string;
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context.userId);

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const ids = list.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, atendente").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, atendente: (p as { atendente?: string | null }).atendente ?? null }]),
    );
    const roleMap = new Map<string, "admin" | "user" | "atendente">();
    (roles ?? []).forEach((r) => {
      const cur = roleMap.get(r.user_id);
      if (r.role === "admin" || !cur) roleMap.set(r.user_id, r.role as "admin" | "user" | "atendente");
    });

    return list.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      full_name: profileMap.get(u.id)?.full_name ?? null,
      atendente: profileMap.get(u.id)?.atendente ?? null,
      role: roleMap.get(u.id) ?? "user",
      created_at: u.created_at,
    }));
  });

const CreateSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "user", "atendente"]),
  atendente: z.string().trim().max(120).optional().nullable(),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("User creation failed");

    if (data.role !== "user") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
      await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role });
    }
    if (data.atendente !== undefined) {
      await supabaseAdmin
        .from("profiles")
        .update({ atendente: data.atendente || null })
        .eq("id", newId);
    }
    return { id: newId };
  });

const RoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "user", "atendente"]),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.user_id === context.userId && data.role !== "admin") {
      throw new Error("Você não pode rebaixar a si mesmo.");
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    if (data.role !== "user") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const AtendenteSchema = z.object({
  user_id: z.string().uuid(),
  atendente: z.string().trim().max(120).nullable(),
});

export const setUserAtendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AtendenteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ atendente: data.atendente || null })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteSchema = z.object({ user_id: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir a si mesmo.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ResetSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(8).max(72),
});

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResetSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAtendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    await assertAdmin(context.userId);
    const [{ data: profs }, { data: vends }] = await Promise.all([
      supabaseAdmin.from("profiles").select("atendente"),
      supabaseAdmin.from("vendas").select("atendente"),
    ]);
    const set = new Set<string>();
    (profs ?? []).forEach((p) => {
      const v = (p as { atendente?: string | null }).atendente;
      if (v && v.trim()) set.add(v.trim());
    });
    (vends ?? []).forEach((v) => {
      const a = (v as { atendente?: string | null }).atendente;
      if (a && a.trim()) set.add(a.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  });