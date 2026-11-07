"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, ShoppingBag, User } from "lucide-react";
import { useCustomerResource } from "@/lib/customer-resource";
import type { ComponentType } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const items: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/cupons", label: "Cupons", icon: Ticket },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/perfil", label: "Perfil", icon: User },
];

function isActivePath(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  const { cliente } = useAuth();

  const activeOrders = useCustomerResource<{ count: number; ativos: number }>(
    cliente?.id,
    "/api/cliente/resumo",
    60_000,
  );
  const pedidosAtivos = activeOrders.data?.ativos ?? 0;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 md:hidden"
      aria-label="Navegação principal"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      {/* Liquid glass: fundo translúcido + blur/saturação + brilho interno no topo.
          Sem suporte a backdrop-filter, cai para um fundo quase opaco. */}
      <ul
        className={cn(
          "pointer-events-auto relative mx-auto grid max-w-md grid-cols-4 gap-1 overflow-hidden rounded-full p-1.5",
          "border border-white/50 bg-card/90 dark:border-white/10",
          "supports-[backdrop-filter]:bg-card/55 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-[1.8]",
          "shadow-[0_10px_30px_-8px_rgba(0,0,0,0.22),inset_0_1px_0_0_rgba(255,255,255,0.65),inset_0_-1px_0_0_rgba(255,255,255,0.15)]",
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:rounded-t-full before:bg-gradient-to-b before:from-white/40 before:to-transparent before:content-[''] dark:before:from-white/10",
        )}
      >
        {items.map((item) => {
          const active = isActivePath(pathname, item.to);
          const Icon = item.icon;
          const isPedidos = item.to === "/pedidos";

          return (
            <li key={item.to} className="relative min-w-0">
              <Link
                href={item.to}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] leading-tight transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active
                    ? "bg-primary/15 font-semibold text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)]"
                    : "font-medium text-foreground/70 hover:text-foreground active:bg-white/40",
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-[22px] w-[22px] transition-transform duration-200",
                      active && "scale-105",
                    )}
                  />
                  {isPedidos && pedidosAtivos > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white ring-2 ring-white/80">
                      {pedidosAtivos > 9 ? "9+" : pedidosAtivos}
                    </span>
                  )}
                </div>
                <span className="max-w-full truncate">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
