/**
 * RBAC Sorvetes Donda — roles do painel + permissões de ação + telas liberadas.
 * Fonte de verdade: tabela public.perfis.
 */

export type AppRole = "cliente" | "admin" | "gerente" | "atendente";

/** Telas do menu admin que podem ser liberadas por usuário/role */
export type AdminPageAccess =
  | "dashboard"
  | "pedidos"
  | "catalogo"
  | "cupons"
  | "clientes"
  | "relatorios"
  | "estabelecimento"
  | "configuracoes";

export const ALL_ADMIN_PAGES: readonly AdminPageAccess[] = [
  "dashboard",
  "pedidos",
  "catalogo",
  "cupons",
  "clientes",
  "relatorios",
  "estabelecimento",
  "configuracoes",
] as const;

export const ADMIN_PAGE_META: Record<
  AdminPageAccess,
  { label: string; href: string; description: string }
> = {
  dashboard: {
    label: "Dashboard",
    href: "/admin",
    description: "Visão geral e indicadores",
  },
  pedidos: {
    label: "Pedidos",
    href: "/admin/pedidos",
    description: "Kanban e gestão de pedidos",
  },
  catalogo: {
    label: "Catálogo",
    href: "/admin/produtos",
    description: "Produtos, categorias e complementos",
  },
  cupons: {
    label: "Cupons",
    href: "/admin/cupons",
    description: "Cupons e promoções",
  },
  clientes: {
    label: "Clientes",
    href: "/admin/clientes",
    description: "Base de clientes",
  },
  relatorios: {
    label: "Relatórios",
    href: "/admin/relatorios",
    description: "Relatórios e financeiro",
  },
  estabelecimento: {
    label: "Estabelecimento",
    href: "/admin/estabelecimento",
    description: "Dados e status da loja",
  },
  configuracoes: {
    label: "Configurações",
    href: "/admin/configuracoes",
    description: "Preferências do sistema e usuários",
  },
};

/** Defaults de telas por role (quando perfis.acessos está vazio/null) */
export const DEFAULT_ROLE_ACESSES: Record<
  Exclude<AppRole, "cliente">,
  readonly AdminPageAccess[]
> = {
  admin: ALL_ADMIN_PAGES,
  gerente: [
    "dashboard",
    "pedidos",
    "catalogo",
    "clientes",
    "relatorios",
    "estabelecimento",
  ],
  atendente: ["pedidos"],
};

export const ROLE_PERMISSIONS: Record<AppRole, readonly string[]> = {
  cliente: [
    "pedido:create",
    "pedido:read_own",
    "perfil:update_own",
    "endereco:manage_own",
  ],
  atendente: [
    "pedido:read",
    "pedido:update_status",
    "catalogo:read",
  ],
  gerente: [
    "pedido:read",
    "pedido:update_status",
    "catalogo:read",
    "catalogo:write",
    "relatorio:read",
    "cliente:read",
  ],
  admin: [
    "pedido:read",
    "pedido:update_status",
    "catalogo:read",
    "catalogo:write",
    "relatorio:read",
    "cliente:read",
    "cliente:write",
    "config:write",
    "admin:manage",
  ],
} as const;

export type Permission = (typeof ROLE_PERMISSIONS)[AppRole][number];

/** Ações que o admin pode ligar/desligar por usuário (além das telas) */
export type StaffCapability =
  | "pedido:update_status"
  | "catalogo:write"
  | "cliente:write"
  | "relatorio:read"
  | "config:write";

export const MANAGEABLE_CAPABILITIES: readonly {
  key: StaffCapability;
  label: string;
  description: string;
}[] = [
  {
    key: "pedido:update_status",
    label: "Alterar status de pedidos",
    description: "Aceitar, preparar, entregar e cancelar pedidos",
  },
  {
    key: "catalogo:write",
    label: "Editar catálogo",
    description: "Criar e alterar produtos, categorias e complementos",
  },
  {
    key: "cliente:write",
    label: "Editar clientes",
    description: "Alterar dados da base de clientes",
  },
  {
    key: "relatorio:read",
    label: "Ver relatórios",
    description: "Acessar dados e indicadores de desempenho",
  },
  {
    key: "config:write",
    label: "Configurar a loja",
    description: "Abrir/fechar loja, aceite automático e preferências",
  },
] as const;

const CAPABILITY_SET = new Set<string>(
  MANAGEABLE_CAPABILITIES.map((c) => c.key)
);

export function isStaffCapability(value: string): value is StaffCapability {
  return CAPABILITY_SET.has(value);
}

/** Defaults de ações gerenciáveis por role */
export const DEFAULT_ROLE_CAPABILITIES: Record<
  Exclude<AppRole, "cliente">,
  readonly StaffCapability[]
> = {
  admin: MANAGEABLE_CAPABILITIES.map((c) => c.key),
  gerente: [
    "pedido:update_status",
    "catalogo:write",
    "relatorio:read",
  ],
  atendente: ["pedido:update_status"],
};

export function hasPermission(
  role: AppRole,
  permission: Permission,
  customPermissoes?: readonly string[] | null
): boolean {
  // Admin sempre pode tudo do painel
  if (role === "admin") {
    return (ROLE_PERMISSIONS.admin as readonly string[]).includes(permission);
  }

  // Se o perfil tem permissoes customizadas, usa-as + leituras básicas do role
  if (customPermissoes && customPermissoes.length > 0) {
    const set = new Set(customPermissoes);
    // Leituras operacionais mínimas; capacidades gerenciáveis respeitam revogação.
    const roleList = ROLE_PERMISSIONS[role] ?? [];
    const readOnly = (roleList as readonly string[]).filter(
      (p) => (p.endsWith(":read") || p.endsWith(":read_own")) && !isStaffCapability(p)
    );
    if (set.has(permission) || readOnly.includes(permission)) return true;
    // pedido:read acompanha quem tem update_status
    if (
      permission === "pedido:read" &&
      set.has("pedido:update_status")
    ) {
      return true;
    }
    if (permission === "catalogo:read" && set.has("catalogo:write")) {
      return true;
    }
    if (permission === "cliente:read" && set.has("cliente:write")) {
      return true;
    }
    return false;
  }

  const list = ROLE_PERMISSIONS[role] ?? [];
  return (list as readonly string[]).includes(permission);
}

export function resolveAdminRole(
  role?: string | null,
  meta?: { role?: string } | null
): AppRole {
  const r = (role || meta?.role || "").toLowerCase().trim();
  if (r === "gerente") return "gerente";
  if (r === "atendente") return "atendente";
  if (r === "admin" || r === "administrador") return "admin";
  return "atendente";
}

const VALID_PAGES = new Set<string>(ALL_ADMIN_PAGES);

export function isAdminPageAccess(value: string): value is AdminPageAccess {
  return VALID_PAGES.has(value);
}

/**
 * Resolve telas liberadas:
 * - admin sempre vê tudo
 * - se perfis.acessos tiver itens válidos, usa-os
 * - senão, defaults do role
 */
export function resolveAcessos(
  role: AppRole,
  stored?: string[] | null
): AdminPageAccess[] {
  if (role === "admin") {
    return [...ALL_ADMIN_PAGES];
  }
  if (role === "cliente") {
    return [];
  }

  const fromStore = (stored ?? [])
    .map((s) => s?.toLowerCase?.() ?? String(s).toLowerCase())
    .filter(isAdminPageAccess);

  if (fromStore.length > 0) {
    return [...new Set(fromStore)];
  }

  const defaults = DEFAULT_ROLE_ACESSES[role] ?? DEFAULT_ROLE_ACESSES.atendente;
  return [...defaults];
}

export function resolvePermissoes(
  role: AppRole,
  stored?: string[] | null
): string[] {
  if (role === "admin") {
    return [...ROLE_PERMISSIONS.admin];
  }
  if (role === "cliente") {
    return [...ROLE_PERMISSIONS.cliente];
  }

  const fromStore = (stored ?? []).filter(Boolean);
  if (fromStore.length > 0) {
    return [...new Set(fromStore)];
  }

  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function resolveCapabilities(
  role: AppRole,
  stored?: string[] | null
): StaffCapability[] {
  if (role === "admin") {
    return MANAGEABLE_CAPABILITIES.map((c) => c.key);
  }

  const fromPerms = (stored ?? []).filter(isStaffCapability);
  if (fromPerms.length > 0 || (stored && stored.length > 0)) {
    // Se tem permissoes custom, só as gerenciáveis marcadas
    return [...new Set(fromPerms)];
  }

  const defaults =
    DEFAULT_ROLE_CAPABILITIES[role as Exclude<AppRole, "cliente">] ??
    DEFAULT_ROLE_CAPABILITIES.atendente;
  return [...defaults];
}

export function hasPageAccess(
  acessos: readonly AdminPageAccess[],
  page: AdminPageAccess
): boolean {
  return acessos.includes(page);
}

/** Mapeia pathname do admin para a chave de acesso */
export function pathToAdminPage(pathname: string): AdminPageAccess | null {
  if (!pathname.startsWith("/admin")) return null;
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  if (pathname.startsWith("/admin/pedidos")) return "pedidos";
  if (
    pathname.startsWith("/admin/produtos") ||
    pathname.startsWith("/admin/categorias") ||
    pathname.startsWith("/admin/adicionais")
  ) {
    return "catalogo";
  }
  if (pathname.startsWith("/admin/cupons")) return "cupons";
  if (pathname.startsWith("/admin/clientes")) return "clientes";
  if (
    pathname.startsWith("/admin/relatorios") ||
    pathname.startsWith("/admin/financeiro")
  ) {
    return "relatorios";
  }
  if (pathname.startsWith("/admin/estabelecimento")) return "estabelecimento";
  if (pathname.startsWith("/admin/configuracoes")) return "configuracoes";
  return null;
}

export function firstAllowedAdminPath(
  acessos: readonly AdminPageAccess[]
): string {
  if (acessos.length === 0) return "/admin/login";
  const ordered = ALL_ADMIN_PAGES.filter((p) => acessos.includes(p));
  const first = ordered[0] ?? acessos[0];
  return ADMIN_PAGE_META[first]?.href ?? "/admin/pedidos";
}

export function roleLabel(role: AppRole | string): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "gerente":
      return "Gerente";
    case "atendente":
      return "Atendente";
    default:
      return String(role);
  }
}

/**
 * Monta lista de permissoes a gravar a partir das capabilities + role base.
 */
export function buildPermissoesFromCapabilities(
  role: AppRole,
  capabilities: StaffCapability[]
): string[] {
  const base = new Set<string>();
  // Leituras mínimas conforme role
  for (const p of ROLE_PERMISSIONS[role] ?? []) {
    if ((String(p).endsWith(":read") || String(p).endsWith(":read_own")) && !isStaffCapability(p)) {
      base.add(p);
    }
  }
  // Sempre pedido:read se for staff
  if (role !== "cliente") base.add("pedido:read");

  for (const cap of capabilities) {
    base.add(cap);
    if (cap === "pedido:update_status") base.add("pedido:read");
    if (cap === "catalogo:write") base.add("catalogo:read");
    if (cap === "cliente:write") base.add("cliente:read");
  }

  return [...base];
}
