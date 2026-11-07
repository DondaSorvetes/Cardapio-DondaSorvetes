"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  firstAllowedAdminPath,
  pathToAdminPage,
  type AdminPageAccess,
} from "@/lib/security/rbac";

/**
 * Bloqueia navegação client-side para telas não liberadas no profile.
 * Complementa requirePageAccess nas pages (server).
 */
export function AccessGuard({
  acessos,
  children,
}: {
  acessos: AdminPageAccess[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/admin/login") return;
    const page = pathToAdminPage(pathname);
    if (!page) return;
    if (!acessos.includes(page)) {
      router.replace(firstAllowedAdminPath(acessos));
    }
  }, [pathname, acessos, router]);

  return <>{children}</>;
}
