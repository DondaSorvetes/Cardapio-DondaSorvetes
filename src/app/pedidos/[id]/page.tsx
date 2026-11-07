"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DetalhePedidoView } from "@/components/cliente/pedidos/DetalhePedidoView";

export default function PaginaDetalhePedido() {
  const { cliente, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  useEffect(() => {
    if (!loading && !cliente) router.push("/entrar");
  }, [loading, cliente, router]);

  if (loading || !cliente) {
    return (
      <main
        role="status"
        aria-label="Carregando pedido"
        className="min-h-[70vh] bg-[#FDF9F9]"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-12 h-8 w-8 animate-spin rounded-full border-2 border-[#D13469] border-t-transparent motion-reduce:animate-none"
        />
      </main>
    );
  }

  return <DetalhePedidoView clienteId={cliente.id} pedidoId={params.id} />;
}
