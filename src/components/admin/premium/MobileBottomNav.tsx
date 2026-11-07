"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminPageAccess } from "@/lib/security/rbac";
import { menuItems, pathIsActive, type MenuItem } from "./PremiumSidebar";

/** Ordem de preferência dos atalhos; entram os 4 primeiros que a pessoa pode acessar. */
const PRIORITY = ["/admin", "/admin/pedidos", "/admin/produtos", "/admin/clientes", "/admin/estabelecimento", "/admin/relatorios", "/admin/cupons", "/admin/configuracoes"];
/** Nomes curtos para caber na barra. */
const SHORT: Record<string, string> = { "/admin": "Início", "/admin/estabelecimento": "Loja", "/admin/configuracoes": "Ajustes" };

export function pickShortcuts(acessos: AdminPageAccess[], max = 4): MenuItem[] {
  return PRIORITY.map((href) => menuItems.find((item) => item.href === href))
    .filter((item): item is MenuItem => Boolean(item) && acessos.includes(item!.access))
    .slice(0, max);
}

/**
 * Barra de atalhos no rodapé, só no celular. "Menu" abre a navegação completa.
 * Some enquanto um campo está em foco, para não ficar em cima do teclado.
 */
export function MobileBottomNav({
  acessos,
  menuOpen,
  onOpenMenu,
}: {
  acessos: AdminPageAccess[];
  menuOpen: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname() ?? "";
  const shortcuts = useMemo(() => pickShortcuts(acessos), [acessos]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) &&
        !/^(checkbox|radio|button|submit|range|color|file)$/i.test((el as HTMLInputElement).type)));
    const onIn = (e: FocusEvent) => setTyping(isField(e.target));
    // Depois do focusout o foco ainda não mudou: confere no próximo ciclo.
    const onOut = () => window.setTimeout(() => setTyping(isField(document.activeElement)), 0);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  const anyActive = shortcuts.some((item) => pathIsActive(pathname, item.href));

  return (
    <nav
      aria-label="Atalhos"
      className={cn(
        "admin-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[#E5E7EB] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden",
        "transition-transform duration-200 motion-reduce:transition-none",
        typing && "translate-y-full",
      )}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {shortcuts.map((item) => {
          const active = pathIsActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-[#C8285F]" : "text-[#6B7280] active:text-[#C8285F]",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-[#FDE6EE]" : "group-active:bg-[#F3F4F6]",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
                </span>
                <span className={cn("leading-none", active && "font-semibold")}>{SHORT[item.href] ?? item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className={cn(
              "group flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              menuOpen || (!anyActive && pathname.startsWith("/admin")) ? "text-[#C8285F]" : "text-[#6B7280]",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                menuOpen || !anyActive ? "bg-[#FDE6EE]" : "group-active:bg-[#F3F4F6]",
              )}
            >
              <Menu className="h-5 w-5" />
            </span>
            <span className="leading-none">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
