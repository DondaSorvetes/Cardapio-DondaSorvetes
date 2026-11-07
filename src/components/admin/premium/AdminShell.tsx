"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
const AutomaticOrderPrint = dynamic(() => import("@/components/admin/pedidos/AutomaticOrderPrint").then(module => module.AutomaticOrderPrint), { ssr: false });
import { ConfiguracoesLojaProvider } from "@/hooks/useConfiguracoesLojaRealtime";
import { PremiumSidebar } from "./PremiumSidebar";
import { PremiumTopbar } from "./PremiumTopbar";
import { cn } from "@/lib/utils";
import type { AdminPageAccess } from "@/lib/security/rbac";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import "./admin-responsive.css";
import { InstallBanner } from "@/components/admin/pwa/InstallBanner";
import { MobileBottomNav } from "./MobileBottomNav";

const SIDEBAR_KEY = "donda-admin-sidebar-collapsed";

interface AdminShellProps {
  adminEmail: string;
  adminName: string;
  roleLabel: string;
  acessos: AdminPageAccess[];
  canManageStore: boolean;
  canAutoPrint?: boolean;
  children: React.ReactNode;
}

export function AdminShell({
  adminEmail,
  adminName,
  roleLabel,
  acessos,
  canManageStore,
  canAutoPrint = false,
  children,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_KEY);
      if (raw === "1" || raw === "true") setCollapsed(true);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <ConfiguracoesLojaProvider>
    <div className="admin-shell min-h-dvh bg-[#F7F8FC]">
      {canAutoPrint && <AutomaticOrderPrint />}
      <a href="#admin-content" className="admin-skip-link">Ir para o conteúdo</a>
      <div className="flex">
        <div className="hidden xl:block">
        <PremiumSidebar
          adminEmail={adminEmail}
          adminName={adminName}
          roleLabel={roleLabel}
          acessos={acessos}
          canManageStore={canManageStore}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="admin-mobile-menu w-[min(320px,100%)] max-w-full p-0"
            onCloseAutoFocus={(event) => { event.preventDefault(); menuTrigger.current?.focus(); }}>
            <SheetTitle className="sr-only">Navegação administrativa</SheetTitle>
            <SheetDescription className="sr-only">Acesse as áreas do painel Sorvetes Donda.</SheetDescription>
            <PremiumSidebar adminEmail={adminEmail} adminName={adminName} roleLabel={roleLabel}
              acessos={acessos} canManageStore={canManageStore} mobile onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <main
          id="admin-content"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1 min-h-dvh flex flex-col transition-[margin] duration-300 ease-in-out motion-reduce:transition-none",
            // evita “pulo” de layout antes de hidratar preferência
            !hydrated && "xl:ml-[270px]",
            hydrated && (collapsed ? "xl:ml-[72px]" : "xl:ml-[270px]")
          )}
        >
          <PremiumTopbar adminName={adminName} adminEmail={adminEmail} onOpenMenu={() => {
            menuTrigger.current = document.activeElement as HTMLElement;
            setMenuOpen(true);
          }} menuOpen={menuOpen} />
          <InstallBanner />
          <div className="admin-content-area min-w-0 flex-1">{children}</div>
        </main>
        <MobileBottomNav acessos={acessos} menuOpen={menuOpen} onOpenMenu={() => {
          menuTrigger.current = document.activeElement as HTMLElement;
          setMenuOpen(true);
        }} />
      </div>
    </div>
    </ConfiguracoesLojaProvider>
  );
}
