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
  const menuActive = menuOpen || (!anyActive && pathname.startsWith("/admin"));

  /* Mesmo item da barra do cliente: pílula com ícone em cima e rótulo embaixo. */
  const itemClass = (active: boolean) =>
    cn(
      "relative flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] leading-tight transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40",
      active
        ? "bg-[#C8285F]/15 font-semibold text-[#C8285F] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)]"
        : "font-medium text-[#1F1A26]/70 hover:text-[#1F1A26] active:bg-white/40",
    );
  const iconClass = (active: boolean) =>
    cn("h-[22px] w-[22px] transition-transform duration-200", active && "scale-105");

  return (
    <nav
      aria-label="Atalhos"
      className={cn(
        "admin-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 md:hidden",
        "transition-transform duration-200 motion-reduce:transition-none",
        typing && "translate-y-[calc(100%+1rem)]",
      )}
    >
      {/* Liquid glass, igual ao app do cliente: fundo translúcido + blur/saturação
          + brilho interno no topo. Sem backdrop-filter, cai para um fundo quase opaco. */}
      <ul
        className={cn(
          "pointer-events-auto relative mx-auto grid max-w-md gap-1 overflow-hidden rounded-full p-1.5",
          "border border-white/50 bg-white/90",
          "supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-[1.8]",
          "shadow-[0_10px_30px_-8px_rgba(0,0,0,0.22),inset_0_1px_0_0_rgba(255,255,255,0.65),inset_0_-1px_0_0_rgba(255,255,255,0.15)]",
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:rounded-t-full before:bg-gradient-to-b before:from-white/40 before:to-transparent before:content-['']",
        )}
        style={{ gridTemplateColumns: `repeat(${shortcuts.length + 1}, minmax(0, 1fr))` }}
      >
        {shortcuts.map((item) => {
          const active = pathIsActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="relative min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <Icon className={iconClass(active)} />
                <span className="max-w-full truncate">{SHORT[item.href] ?? item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="relative min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className={itemClass(menuActive)}
          >
            <Menu className={iconClass(menuActive)} />
            <span className="max-w-full truncate">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

