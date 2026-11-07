"use client";

import { useState, useEffect } from "react";
import { Cliente } from "@/types/cliente";
import { ClienteList } from "./ClienteList";
import { ClienteDetailPanel } from "./ClienteDetailPanel";
import { ClienteSidePanel } from "./ClienteSidePanel";
import { EmptyState } from "./EmptyState";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

interface ClientesManagerProps {
  clientesIniciais: Cliente[];
}

export function ClientesManager({ clientesIniciais }: ClientesManagerProps) {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const supabase = createClient();

  // Setup Realtime
  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel("clientes-changes-" + crypto.randomUUID())
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clientes",
        },
        (payload) => {
          if (!active) return;
          if (payload.eventType === "INSERT") {
            const novoCliente = payload.new as Cliente;
            setClientes((prev) => [novoCliente, ...prev.filter(c => c.id !== novoCliente.id)]);
            toast.success("Novo cliente cadastrado");
          } else if (payload.eventType === "UPDATE") {
            const clienteAtualizado = payload.new as Cliente;
            setClientes((prev) =>
              prev.map((c) => (c.id === clienteAtualizado.id ? clienteAtualizado : c))
            );
            setSelectedCliente(current => current?.id === clienteAtualizado.id ? clienteAtualizado : current);
            toast.success("Cliente atualizado");
          } else if (payload.eventType === "DELETE") {
            const clienteRemovido = payload.old as Cliente;
            setClientes((prev) => prev.filter((c) => c.id !== clienteRemovido.id));
            setSelectedCliente(current => current?.id === clienteRemovido.id ? null : current);
            toast.success("Cliente removido");
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleSelect = (cliente: Cliente) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedCliente(cliente);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <div className="admin-workspace flex min-w-0 overflow-hidden bg-[#F8F9FC]">
      {/* Lista de Clientes - Esquerda */}
      <div className={`${selectedCliente ? "hidden lg:block" : "block"} w-full shrink-0 lg:w-[300px] xl:w-[320px]`}>
      <ClienteList
        clientes={clientes}
        selectedId={selectedCliente?.id}
        onSelect={handleSelect}
      />
      </div>

      {/* Painel de Detalhes - Centro com Animação */}
      <div className={`${selectedCliente ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col overflow-y-auto 2xl:flex-row`}>
      {selectedCliente && <button type="button" onClick={() => setSelectedCliente(null)}
        className="flex shrink-0 items-center gap-2 border-b bg-white px-4 py-3 text-sm font-medium text-[#C8285F] lg:hidden">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar para clientes
      </button>}
      <div
        className={`min-w-0 flex-1 transition-opacity duration-200 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        {selectedCliente ? (
          <ClienteDetailPanel cliente={selectedCliente} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Painel Lateral - Direita com Animação */}
      {selectedCliente && (
        <div
          className={`shrink-0 transition-opacity duration-200 ${
            isTransitioning
              ? "opacity-0 translate-x-4"
              : "opacity-100 translate-x-0"
          }`}
        >
          <ClienteSidePanel cliente={selectedCliente} />
        </div>
      )}
      </div>
    </div>
  );
}
