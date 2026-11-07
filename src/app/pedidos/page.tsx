"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MeusPedidosView } from "@/components/cliente/pedidos/MeusPedidosView";

export default function PaginaPedidos() {
  const { cliente, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !cliente) {
      router.push("/entrar");
    }
  }, [loading, cliente, router]);

  if (loading) {
    return (
      <div role="status" aria-label="Carregando seus pedidos" className="min-h-[70vh] flex items-center justify-center">
        <div aria-hidden="true" className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin motion-reduce:animate-none" />
      </div>
    );
  }

  if (!cliente) return null;

  return <MeusPedidosView clienteId={cliente.id} />;
}
