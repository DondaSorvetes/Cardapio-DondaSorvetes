"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, X } from "lucide-react";
import { DetalhesPedido } from "./DetalhesPedido";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type Pedido = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  tipo_entrega: string;
  endereco_id: string;
  endereco_completo: {
    id: string;
    cep: string;
    bairro: string;
    cidade: string;
    estado: string;
    numero: string;
    apelido: string;
    principal: boolean;
    created_at: string;
    logradouro: string;
    complemento: string;
  } | null;
  meio_pagamento: string;
  troco_para: string | null;
  subtotal: string;
  taxa_entrega: string;
  total: string;
  itens: Array<{
    qty: number;
    uid: string;
    total: number;
    produto: {
      id: string;
      name: string;
      image: string;
      price: number;
    };
    selections: Record<string, string[]>;
    observacoes: string;
  }>;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type PedidosListaProps = {
  pedidosIniciais: Pedido[];
};

const statusConfig: Record<string, { label: string; cor: string; bg: string }> = {
  pendente: { label: "Pendente", cor: "#3b82f6", bg: "#dbeafe" },
  confirmado: { label: "Confirmado", cor: "#3b82f6", bg: "#dbeafe" },
  preparando: { label: "Em preparação", cor: "#f59e0b", bg: "#fef3c7" },
  saiu_entrega: { label: "Saiu p/ entrega", cor: "#8b5cf6", bg: "#ede9fe" },
  entregue: { label: "Entregue", cor: "#10b981", bg: "#d1fae5" },
  cancelado: { label: "Cancelado", cor: "#ef4444", bg: "#fee2e2" },
};

export function PedidosLista({ pedidosIniciais }: PedidosListaProps) {
  const [pedidos, setPedidos] = useState(pedidosIniciais);
  const [busca, setBusca] = useState("");
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const termo = busca.toLowerCase();
    return (
      pedido.cliente_nome.toLowerCase().includes(termo) ||
      pedido.id.toLowerCase().includes(termo) ||
      pedido.cliente_telefone?.includes(termo)
    );
  });

  const atualizarStatus = async (pedidoId: string, novoStatus: string) => {
    try {
      const res = await fetch("/api/pedidos/atualizar-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: pedidoId, status: novoStatus }),
      });

      if (res.ok) {
        setPedidos((prev) =>
          prev.map((p) => (p.id === pedidoId ? { ...p, status: novoStatus } : p))
        );
        if (pedidoSelecionado?.id === pedidoId) {
          setPedidoSelecionado({ ...pedidoSelecionado, status: novoStatus });
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const handleSelectPedido = (pedido: Pedido) => {
    setPedidoSelecionado(pedido);
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setTimeout(() => setPedidoSelecionado(null), 300);
  };

  return (
    <>
      <div className="h-full">
        {/* Mobile/Tablet: Lista completa */}
        <div className="lg:hidden h-full flex flex-col">
          {/* Header Mobile */}
          <div className="bg-white border-b border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">Últimos pedidos</h1>
              <Button size="sm" className="bg-[#dc2626] hover:bg-[#b91c1c]">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar pedido..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Lista Mobile */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {pedidosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 px-4">
                <p className="text-center">Seus pedidos aparecerão aqui!</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {pedidosFiltrados.map((pedido) => {
                  const config = statusConfig[pedido.status] || statusConfig.pendente;
                  const minutos = Math.floor(
                    (new Date().getTime() - new Date(pedido.created_at).getTime()) / 60000
                  );
                  const tempoTexto =
                    minutos < 60
                      ? `${minutos} min`
                      : minutos < 1440
                      ? `${Math.floor(minutos / 60)}h ${minutos % 60}m`
                      : `${Math.floor(minutos / 1440)}d`;

                  return (
                    <button
                      key={pedido.id}
                      onClick={() => handleSelectPedido(pedido)}
                      className="w-full bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-semibold">
                            {pedido.cliente_nome.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {pedido.cliente_nome}
                              </h3>
                              <p className="text-xs text-gray-500">#{pedido.id.slice(0, 8)}</p>
                            </div>
                            <span className="text-xs text-gray-500 ml-2">{tempoTexto}</span>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <span className="font-semibold text-gray-900">
                              R$ {parseFloat(pedido.total).toFixed(2).replace(".", ",")}
                            </span>
                            <span
                              className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{ backgroundColor: config.bg, color: config.cor }}
                            >
                              {config.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Layout em duas colunas */}
        <div className="hidden lg:flex h-[calc(100vh-80px)]">
          {/* Lista de pedidos - Esquerda */}
          <div className="w-[420px] bg-white border-r border-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              <h1 className="text-xl font-semibold text-gray-900">Últimos pedidos</h1>
              
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Pesquise por cliente ou número do pedido"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

              {/* Botão Novo Pedido */}
              <Button className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white">
                <Plus className="h-4 w-4 mr-2" />
                NOVO PEDIDO
              </Button>
            </div>

            {/* Lista de Pedidos */}
            <div className="flex-1 overflow-y-auto">
              {pedidosFiltrados.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <p className="text-center px-4">Seus pedidos aparecerão aqui!</p>
                </div>
              )}

              {pedidosFiltrados.map((pedido) => {
                const config = statusConfig[pedido.status] || statusConfig.pendente;
                const minutos = Math.floor(
                  (new Date().getTime() - new Date(pedido.created_at).getTime()) / 60000
                );
                const tempoTexto =
                  minutos < 60
                    ? `${minutos} min`
                    : minutos < 1440
                    ? `${Math.floor(minutos / 60)} h ${minutos % 60} min`
                    : `${Math.floor(minutos / 1440)} d`;

                return (
                  <div
                    key={pedido.id}
                    onClick={() => handleSelectPedido(pedido)}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      pedidoSelecionado?.id === pedido.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-semibold">
                          {pedido.cliente_nome.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {pedido.cliente_nome}
                            </h3>
                            <p className="text-xs text-gray-500">#{pedido.id.slice(0, 8)}</p>
                          </div>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {tempoTexto}
                          </span>
                        </div>

                        <p className="text-sm text-gray-700 mb-2">
                          Total R$ {parseFloat(pedido.total).toFixed(2).replace(".", ",")}
                        </p>

                        {/* Status Badge */}
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: config.bg,
                            color: config.cor,
                          }}
                        >
                          {config.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detalhes do pedido - Direita */}
          <div className="flex-1 bg-gray-50">
            {pedidoSelecionado ? (
              <DetalhesPedido
                pedido={pedidoSelecionado}
                onStatusChange={atualizarStatus}
                onClose={() => setPedidoSelecionado(null)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="h-8 w-8 text-gray-400" />
                  </div>
                  <p>Selecione um pedido para ver os detalhes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sheet Mobile para Detalhes */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          {pedidoSelecionado && (
            <DetalhesPedido
              pedido={pedidoSelecionado}
              onStatusChange={atualizarStatus}
              onClose={handleCloseSheet}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
