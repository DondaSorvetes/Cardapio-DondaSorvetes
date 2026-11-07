"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MeuPerfilView } from "@/components/cliente/perfil/MeuPerfilView";
import type { Endereco } from "@/types/endereco";

type ClienteFull = {
  id: string;
  nome: string | null;
  telefone: string | null;
  endereco: string | null;
  enderecos_adicionais?: Endereco[] | string | null;
  created_at?: string;
  email?: string | null;
};

export default function PaginaPerfil() {
  const { cliente, loading, refreshCliente, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !cliente) {
      router.push("/entrar");
    }
  }, [loading, cliente, router]);

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-background">
        <div className="mx-auto max-w-lg px-4 py-8 space-y-6 animate-pulse">
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-full bg-muted" />
            <div className="h-5 w-36 rounded-lg bg-muted" />
            <div className="h-4 w-28 rounded-lg bg-muted" />
          </div>
          <div className="h-56 rounded-2xl bg-muted" />
          <div className="h-12 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!cliente) return null;

  return (
    <MeuPerfilView
      cliente={cliente as ClienteFull}
      onRefresh={refreshCliente}
      onSignOut={signOut}
    />
  );
}
