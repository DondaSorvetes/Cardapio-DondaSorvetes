"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PreferenciasView } from "@/components/cliente/perfil/PreferenciasView";

export default function PaginaPreferencias() {
  const { cliente, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !cliente) {
      router.push("/entrar");
    }
  }, [loading, cliente, router]);

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-background">
        <div className="mx-auto max-w-lg px-4 py-6 space-y-4 animate-pulse">
          <div className="h-10 w-48 rounded-xl bg-muted" />
          <div className="h-36 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!cliente) return null;

  return <PreferenciasView />;
}
