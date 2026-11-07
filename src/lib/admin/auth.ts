import { adminNeedsMfa } from "@/lib/security/admin-mfa";
import { cache } from "react";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { redirect } from "next/navigation";
import {
  resolveAdminRole,
  resolveAcessos,
  resolvePermissoes,
  hasPermission,
  hasPageAccess,
  firstAllowedAdminPath,
  type Permission,
  type AdminPageAccess,
  type AppRole,
} from "@/lib/security/rbac";

export type AdminSession = {
  user: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  };
  role: AppRole;
  acessos: AdminPageAccess[];
  /** Permissões efetivas (role + custom de perfis.permissoes) */
  permissoes: string[];
  admin: {
    id: string;
    auth_user_id: string;
    nome: string;
    email: string;
    role: AppRole;
    created_at: string;
  };
};

/**
 * Exige sessão Supabase Auth + linha em public.perfis.
 * Perfil lido via service role (evita RLS bloqueando) após validar o JWT.
 */
export const getAdminUser = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  if (await adminNeedsMfa(supabase, user)) return null;

  // Service role para ler o perfil com segurança após auth
  let perfil: {
    id: string;
    nome: string | null;
    email: string | null;
    role: string | null;
    acessos?: string[] | null;
    permissoes?: string[] | null;
    created_at?: string | null;
  } | null = null;

  try {
    const adminDb = createServiceRoleClient();
    const full = await adminDb
      .from("perfis")
      .select("id, nome, email, role, acessos, permissoes, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!full.error && full.data) {
      perfil = full.data;
    } else {
      const basic = await adminDb
        .from("perfis")
        .select("id, nome, email, role, acessos, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!basic.error && basic.data) {
        perfil = { ...basic.data, permissoes: null };
      } else {
        const minimal = await adminDb
          .from("perfis")
          .select("id, nome, email, role")
          .eq("id", user.id)
          .maybeSingle();

        if (!minimal.error && minimal.data) {
          perfil = {
            ...minimal.data,
            acessos: null,
            permissoes: null,
            created_at: user.created_at || new Date().toISOString(),
          };
        } else if (minimal.error) {
          console.error("[getAdminUser] perfis:", minimal.error.message);
        }
      }
    }
  } catch (e) {
    console.error("[getAdminUser] service role:", e);
    // Fallback: tenta com o client da sessão (RLS)
    const { data, error } = await supabase
      .from("perfis")
      .select("id, nome, email, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!error && data) {
      perfil = {
        ...data,
        acessos: null,
        permissoes: null,
        created_at: user.created_at || new Date().toISOString(),
      };
    }
  }

  if (!perfil) {
    return null;
  }

  return buildSession(user, perfil);
});

function buildSession(
  user: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  },
  perfil: {
    id: string;
    nome: string | null;
    email: string | null;
    role: string | null;
    acessos?: string[] | null;
    permissoes?: string[] | null;
    created_at?: string | null;
  }
): AdminSession {
  const role = resolveAdminRole(perfil.role);
  const acessos = resolveAcessos(role, perfil.acessos ?? null);
  const permissoes = resolvePermissoes(role, perfil.permissoes ?? null);

  const email = perfil.email || user.email || "";
  const nome =
    perfil.nome ||
    (user.user_metadata?.nome as string | undefined) ||
    email.split("@")[0] ||
    "Usuário";

  return {
    user,
    role,
    acessos,
    permissoes,
    admin: {
      id: perfil.id,
      auth_user_id: user.id,
      nome,
      email,
      role,
      created_at:
        perfil.created_at || user.created_at || new Date().toISOString(),
    },
  };
}

export async function requireAdmin(): Promise<AdminSession> {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    redirect("/admin/login");
  }

  return adminUser;
}

export async function requireAdminApi(): Promise<AdminSession> {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    throw new Error("UNAUTHORIZED");
  }
  return adminUser;
}

export async function requirePermission(permission: Permission) {
  const adminUser = await requireAdmin();
  if (!hasPermission(adminUser.role, permission, adminUser.permissoes)) {
    throw new Error("Permissão insuficiente para esta ação");
  }
  return adminUser;
}

export async function requirePermissionApi(permission: Permission) {
  const adminUser = await requireAdminApi();
  if (!hasPermission(adminUser.role, permission, adminUser.permissoes)) {
    throw new Error("FORBIDDEN");
  }
  return adminUser;
}

export async function requirePageAccess(page: AdminPageAccess) {
  const adminUser = await requireAdmin();
  if (!hasPageAccess(adminUser.acessos, page)) {
    redirect(firstAllowedAdminPath(adminUser.acessos));
  }
  return adminUser;
}

export async function verifyAdmin() {
  const adminUser = await getAdminUser();

  return {
    isAdmin: !!adminUser,
    user: adminUser,
  };
}
