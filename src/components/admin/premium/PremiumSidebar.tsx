"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  BarChart3,
  Settings,
  Store,
  LogOut,
  ChevronRight,
  ChevronLeft,
  TicketPercent,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StoreStatusCard } from "./StoreStatusCard";
import { supabase } from "@/integrations/supabase/client";
import type { AdminPageAccess } from "@/lib/security/rbac";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PremiumSidebarProps {
  adminEmail: string;
  adminName?: string;
  roleLabel?: string;
  acessos: AdminPageAccess[];
  canManageStore?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
}

export type MenuItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  access: AdminPageAccess;
  badge?: string;
  group?: string;
};

export const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    access: "dashboard",
  },
  {
    label: "Pedidos",
    href: "/admin/pedidos",
    icon: ShoppingBag,
    access: "pedidos",
  },
  {
    label: "Catálogo",
    href: "/admin/produtos",
    icon: Package,
    access: "catalogo",
  },
  {
    label: "Cupons",
    href: "/admin/cupons",
    icon: TicketPercent,
    access: "cupons",
  },
  {
    label: "Clientes",
    href: "/admin/clientes",
    icon: Users,
    access: "clientes",
  },
  {
    label: "Relatórios",
    href: "/admin/relatorios",
    icon: BarChart3,
    access: "relatorios",
  },
  {
    label: "Estabelecimento",
    href: "/admin/estabelecimento",
    icon: Store,
    access: "estabelecimento",
    group: "config",
  },
  {
    label: "Configurações",
    href: "/admin/configuracoes",
    icon: Settings,
    access: "configuracoes",
    group: "config",
  },
];

export function pathIsActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/produtos") {
    return (
      pathname === "/admin/produtos" ||
      pathname.startsWith("/admin/produtos/") ||
      pathname.startsWith("/admin/categorias") ||
      pathname.startsWith("/admin/adicionais")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLinkTrailing() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#C8285F]" aria-hidden />
  ) : null;
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: string;
  collapsed?: boolean;
}) {
  const link = (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg text-sm transition-colors duration-150",
        active
          ? "bg-[#FDF0F4] font-semibold text-[#C8285F]"
          : "font-medium text-[#4B5563] hover:bg-[#F7F7F9] hover:text-[#111827]",
        collapsed ? "h-10 justify-center" : "px-3 py-2",
      )}
    >
      {active && !collapsed && (
        <span className="absolute -left-4 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#C8285F]" />
      )}
      <Icon
        className={cn(
          "shrink-0",
          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
          active ? "text-[#C8285F]" : "text-[#9CA3AF] group-hover:text-[#4B5563]",
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge && (
            <span
              className={cn(
                "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md shrink-0",
                active
                  ? "bg-white/80 text-[#C8285F]"
                  : "bg-amber-50 text-amber-700 border border-amber-100",
              )}
            >
              {badge}
            </span>
          )}
          <SidebarLinkTrailing />
        </>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
        {badge ? ` · ${badge}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export function PremiumSidebar({
  adminEmail,
  adminName,
  roleLabel: roleName = "Usuário",
  acessos,
  canManageStore = false,
  collapsed = false,
  onToggleCollapsed,
  mobile = false,
  onNavigate,
}: PremiumSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const allowedItems = useMemo(
    () => menuItems.filter((item) => acessos.includes(item.access)),
    [acessos],
  );
  const mainItems = useMemo(
    () => allowedItems.filter((item) => !item.group),
    [allowedItems],
  );
  const configItems = useMemo(
    () => allowedItems.filter((item) => item.group === "config"),
    [allowedItems],
  );
  const canOpenConfig = acessos.includes("configuracoes");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const displayName = adminName || adminEmail || "Usuário";
  const initial = (displayName.charAt(0) || "U").toUpperCase();

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "bg-white border-r border-[#EEF0F3] flex flex-col transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
          mobile ? "relative h-full w-full" : "fixed left-0 top-0 h-dvh z-40",
          !mobile && (collapsed ? "w-[72px]" : "w-[270px]"),
        )}
      >
        {/* Topo: seta para recolher/expandir */}
        <div
          className={cn(
            "relative shrink-0",
            "h-14",
          )}
        >
          {!collapsed && (
            <div className="flex h-full items-center px-5 pr-12">
              <p className="truncate text-[15px] font-bold tracking-tight text-[#111827]">
                Sorvetes Donda<span className="ml-1.5 text-xs font-medium text-[#9CA3AF]">Admin</span>
              </p>
            </div>
          )}
          {onToggleCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className={cn(
                    "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]",
                    collapsed ? "left-1/2 -translate-x-1/2" : "right-3",
                  )}
                  aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {collapsed ? "Expandir menu" : "Recolher menu"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <StoreStatusCard
          canManageStore={canManageStore}
          canOpenConfig={canOpenConfig}
          collapsed={collapsed}
        />

        <nav
          aria-label="Navegação administrativa"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) onNavigate?.();
          }}
          className={cn(
            "flex-1 py-3 overflow-y-auto overflow-x-hidden",
            collapsed ? "px-2" : "px-4",
          )}
        >
          {mainItems.length > 0 && (
            <>
              <div className="space-y-0.5">
                {mainItems.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    badge={item.badge}
                    collapsed={collapsed}
                    active={pathIsActive(pathname, item.href)}
                  />
                ))}
              </div>
            </>
          )}

          {configItems.length > 0 && (
            <>
              {!collapsed && (
                <p className="mb-1.5 mt-6 px-3 text-[11px] font-medium text-[#9CA3AF]">
                  Configurações
                </p>
              )}
              {collapsed && (
                <div className="my-3 mx-2 border-t border-[#E5E7EB]" />
              )}
              <div className="space-y-0.5">
                {configItems.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    badge={item.badge}
                    collapsed={collapsed}
                    active={pathIsActive(pathname, item.href)}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        <div
          className={cn("border-t border-[#EEF0F3]", collapsed ? "p-2" : "px-4 py-3")}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-9 h-9 rounded-full bg-[#C8285F] flex items-center justify-center"
                title={`${displayName} · ${roleName}`}
              >
                <span className="text-white font-semibold text-xs">
                  {initial}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-red-50 transition-colors"
                    aria-label="Sair"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDF0F4]">
                <span className="text-sm font-semibold text-[#C8285F]">{initial}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#111827]">{displayName}</p>
                <p className="truncate text-xs text-[#9CA3AF]" title={adminEmail || undefined}>
                  {roleName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:bg-red-50 hover:text-[#B42318]"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sair
              </button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
