"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { requirePermission } from "@/lib/admin/auth";
import {
  ALL_ADMIN_PAGES,
  DEFAULT_ROLE_ACESSES,
  DEFAULT_ROLE_CAPABILITIES,
  isAdminPageAccess,
  isStaffCapability,
  resolveAdminRole,
  resolveAcessos,
  resolveCapabilities,
  buildPermissoesFromCapabilities,
  type AdminPageAccess,
  type AppRole,
  type StaffCapability,
} from "@/lib/security/rbac";

export type ProfileRow = {
  id: string;
  nome: string | null;
  email: string | null;
  role: AppRole;
  acessos: AdminPageAccess[];
  acessos_custom: AdminPageAccess[] | null;
  capabilities: StaffCapability[];
  created_at: string;
  updated_at: string | null;
};

type PerfilDb = {
  id: string;
  nome: string | null;
  email: string | null;
  role: string | null;
  acessos?: string[] | null;
  permissoes?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function parseAcessos(raw: string[] | null | undefined): AdminPageAccess[] | null {
  if (!raw || raw.length === 0) return null;
  const valid = raw.filter(isAdminPageAccess);
  return valid.length > 0 ? [...new Set(valid)] : null;
}

function mapRow(row: PerfilDb): ProfileRow {
  const role = resolveAdminRole(row.role);
  const custom = parseAcessos(row.acessos ?? null);
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    role,
    acessos: resolveAcessos(role, row.acessos ?? null),
    acessos_custom: custom,
    capabilities: resolveCapabilities(role, row.permissoes ?? null),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at ?? null,
  };
}

/**
 * Lista todos os perfis (service role — bypass RLS após checar admin).
 */
export async function listProfiles(): Promise<ProfileRow[]> {
  await requirePermission("admin:manage");
  const supabase = createServiceRoleClient();

  // Tentativa completa
  const full = await supabase
    .from("perfis")
    .select("id, nome, email, role, acessos, permissoes, created_at, updated_at")
    .order("nome", { ascending: true, nullsFirst: false });

  if (!full.error && full.data) {
    return full.data.map((row) => mapRow(row as PerfilDb));
  }

  // Sem permissoes
  const mid = await supabase
    .from("perfis")
    .select("id, nome, email, role, acessos, created_at, updated_at")
    .order("nome", { ascending: true, nullsFirst: false });

  if (!mid.error && mid.data) {
    return mid.data.map((row) => mapRow(row as PerfilDb));
  }

  // Mínimo
  const basic = await supabase
    .from("perfis")
    .select("id, nome, email, role")
    .order("nome", { ascending: true, nullsFirst: false });

  if (basic.error) {
    console.error("[listProfiles]", full.error?.message, mid.error?.message, basic.error.message);
    throw new Error(
      basic.error.message ||
        "Não foi possível listar os usuários da tabela perfis."
    );
  }

  return (basic.data ?? []).map((row) => mapRow(row as PerfilDb));
}

export async function updateProfileRole(
  profileId: string,
  role: Exclude<AppRole, "cliente">
): Promise<ProfileRow> {
  const session = await requirePermission("admin:manage");

  if (!["admin", "gerente", "atendente"].includes(role)) {
    throw new Error("Role inválida.");
  }

  if (session.admin.id === profileId && role !== "admin") {
    throw new Error("Você não pode remover o próprio acesso de administrador.");
  }

  const supabase = createServiceRoleClient();

  const defaultAcessos =
    role === "admin" ? [...ALL_ADMIN_PAGES] : [...DEFAULT_ROLE_ACESSES[role]];
  const defaultCaps =
    role === "admin"
      ? [...DEFAULT_ROLE_CAPABILITIES.admin]
      : [...DEFAULT_ROLE_CAPABILITIES[role]];
  const defaultPerms =
    role === "admin"
      ? null
      : buildPermissoesFromCapabilities(role, defaultCaps);

  const payload: Record<string, unknown> = {
    role,
    acessos: role === "admin" ? null : defaultAcessos,
    permissoes: defaultPerms,
  };

  const { data, error } = await supabase
    .from("perfis")
    .update(payload as never)
    .eq("id", profileId)
    .select("id, nome, email, role, acessos, permissoes, created_at, updated_at")
    .maybeSingle();

  if (!error && data) {
    revalidatePath("/admin/configuracoes");
    return mapRow(data as PerfilDb);
  }

  // Fallback sem permissoes
  const fallback = await supabase
    .from("perfis")
    .update({
      role,
      acessos: role === "admin" ? null : defaultAcessos,
    } as never)
    .eq("id", profileId)
    .select("id, nome, email, role, acessos, created_at, updated_at")
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    // Só role
    const onlyRole = await supabase
      .from("perfis")
      .update({ role } as never)
      .eq("id", profileId)
      .select("id, nome, email, role")
      .maybeSingle();

    if (onlyRole.error || !onlyRole.data) {
      console.error(
        "[updateProfileRole]",
        error?.message,
        fallback.error?.message,
        onlyRole.error?.message
      );
      throw new Error("Não foi possível atualizar o papel do usuário.");
    }

    revalidatePath("/admin/configuracoes");
    return mapRow(onlyRole.data as PerfilDb);
  }

  revalidatePath("/admin/configuracoes");
  return mapRow(fallback.data as PerfilDb);
}

export async function updateProfileAcessos(
  profileId: string,
  acessos: AdminPageAccess[]
): Promise<ProfileRow> {
  await requirePermission("admin:manage");

  const valid = [...new Set(acessos.filter(isAdminPageAccess))];
  if (valid.length === 0) {
    throw new Error("Selecione ao menos uma tela de acesso.");
  }

  const supabase = createServiceRoleClient();

  const { data: current, error: loadError } = await supabase
    .from("perfis")
    .select("id, role, permissoes")
    .eq("id", profileId)
    .maybeSingle();

  if (loadError || !current) {
    throw new Error("Usuário não encontrado.");
  }

  const role = resolveAdminRole(current.role);
  if (role === "admin") {
    throw new Error("Administradores têm acesso total a todas as telas.");
  }

  const { data, error } = await supabase
    .from("perfis")
    .update({ acessos: valid } as never)
    .eq("id", profileId)
    .select("id, nome, email, role, acessos, permissoes, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    console.error("[updateProfileAcessos]", error?.message);
    throw new Error(
      "Não foi possível atualizar as telas. Confirme se a coluna acessos existe em public.perfis."
    );
  }

  revalidatePath("/admin/configuracoes");
  return mapRow(data as PerfilDb);
}

export async function updateProfileCapabilities(
  profileId: string,
  capabilities: StaffCapability[]
): Promise<ProfileRow> {
  await requirePermission("admin:manage");

  const valid = [...new Set(capabilities.filter(isStaffCapability))];

  const supabase = createServiceRoleClient();

  const { data: current, error: loadError } = await supabase
    .from("perfis")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();

  if (loadError || !current) {
    throw new Error("Usuário não encontrado.");
  }

  const role = resolveAdminRole(current.role);
  if (role === "admin") {
    throw new Error("Administradores têm todas as permissões.");
  }

  const permissoes = buildPermissoesFromCapabilities(role, valid);

  const { data, error } = await supabase
    .from("perfis")
    .update({ permissoes } as never)
    .eq("id", profileId)
    .select("id, nome, email, role, acessos, permissoes, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    console.error("[updateProfileCapabilities]", error?.message);
    throw new Error(
      "Não foi possível atualizar as permissões. Confirme se a coluna permissoes existe em public.perfis."
    );
  }

  revalidatePath("/admin/configuracoes");
  return mapRow(data as PerfilDb);
}
