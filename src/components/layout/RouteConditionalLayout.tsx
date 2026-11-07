"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { BarraSacola } from "@/components/cardapio/BarraSacola";

export function RouteConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isStandaloneAuth = pathname === "/entrar" || pathname === "/cadastrar";
  const showStoreNavigation = !isAdminRoute && !isStandaloneAuth;

  return (
    <div className={`min-h-screen bg-background ${showStoreNavigation ? "pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-0" : ""}`}>
      {showStoreNavigation && <Header />}
      {children}
      {showStoreNavigation && (
        <>
          <BarraSacola />
          <BottomNav />
        </>
      )}
    </div>
  );
}
