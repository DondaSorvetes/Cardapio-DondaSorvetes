"use client";

import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  TrendingUp,
  FileText,
  Settings,
  Store,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Package,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Pedidos",
    href: "/admin/pedidos",
    icon: ShoppingBag,
  },
  {
    label: "Clientes",
    href: "/admin/clientes",
    icon: Users,
  },
  {
    label: "Produtos",
    href: "/admin/produtos",
    icon: Package,
  },
  {
    label: "Financeiro",
    href: "/admin/financeiro",
    icon: TrendingUp,
  },
  {
    label: "Relatórios",
    href: "/admin/relatorios",
    icon: FileText,
  },
  {
    label: "Estabelecimento",
    href: "/admin/estabelecimento",
    icon: Store,
  },
  {
    label: "Configurações",
    href: "/admin/configuracoes",
    icon: Settings,
  },
];

interface SidebarProps {
  adminEmail?: string;
}

export function Sidebar({ adminEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 hover:bg-gray-50 transition-all duration-200"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? (
          <X className="w-5 h-5 text-gray-700" />
        ) : (
          <Menu className="w-5 h-5 text-gray-700" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 bg-white border-r border-gray-200/80 flex flex-col transition-all duration-300 ease-in-out",
          isCollapsed ? "w-20" : "w-72",
          isMobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200/80">
          <div className={cn("flex items-center gap-3 transition-opacity duration-200", isCollapsed && "opacity-0")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C8285F] to-[#6b3cb0] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Sorvetes Donda
                </h1>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex w-6 h-6 items-center justify-center rounded-md hover:bg-gray-100 transition-colors duration-200"
            aria-label="Toggle sidebar"
          >
            <ChevronLeft
              className={cn(
                "w-4 h-4 text-gray-500 transition-transform duration-200",
                isCollapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (pathname.startsWith(`${item.href}/`) && item.href !== "/admin");
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(item.href);
                  setIsMobileOpen(false);
                }}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 relative",
                  isActive
                    ? "bg-gradient-to-r from-[#C8285F]/10 to-[#C8285F]/5 text-[#C8285F]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#C8285F] rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive && "text-[#C8285F]"
                  )}
                />
                {!isCollapsed && <span>{item.label}</span>}
              </a>
            );
          })}
        </nav>

        {/* User Section & Logout */}
        <div className="border-t border-gray-200/80 p-4 space-y-2">
          {/* User Info */}
          {!isCollapsed && (
            <div className="px-3 py-2 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50">
              <p className="text-xs font-medium text-gray-900 truncate">
                {adminEmail || "Administrador"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Admin</p>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200 group",
              isCollapsed && "justify-center"
            )}
            title={isCollapsed ? "Sair" : undefined}
          >
            <LogOut className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
