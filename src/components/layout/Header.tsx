"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, ShoppingBag, User } from "lucide-react";
import type { ComponentType } from "react";
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

export function Header() {
  const pathname = usePathname();

  return (
    <header className="hidden md:block bg-primary text-primary-foreground">
      <nav className="mx-auto flex max-w-6xl items-center justify-around px-6 py-3">
        {items.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              href={item.to}
              prefetch={false}
              className={cn(
                "relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition",
                active
                  ? "bg-card text-primary shadow-sm"
                  : "text-primary-foreground/90 hover:text-primary-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
