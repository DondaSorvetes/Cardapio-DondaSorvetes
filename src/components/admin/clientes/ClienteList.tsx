"use client";

import { useState, useMemo } from "react";
import { Cliente } from "@/types/cliente";
import { ClienteListItem } from "./ClienteListItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";

interface ClienteListProps {
  clientes: Cliente[];
  selectedId?: string;
  onSelect: (cliente: Cliente) => void;
}

export function ClienteList({
  clientes,
  selectedId,
  onSelect,
}: ClienteListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<string>("nome");

  const clientesFiltrados = useMemo(() => {
    let filtered = [...clientes];

    // Filtro de pesquisa
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.nome.toLowerCase().includes(term) ||
          c.telefone?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term)
      );
    }

    // Filtro de status
    if (statusFilter !== "todos") {
      filtered = filtered.filter((c) => c.status_cliente === statusFilter);
    }

    // Ordenação
    switch (sortBy) {
      case "nome":
        filtered.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case "ultimo-pedido":
        filtered.sort((a, b) => {
          const dateA = a.ultimo_pedido ? new Date(a.ultimo_pedido).getTime() : 0;
          const dateB = b.ultimo_pedido ? new Date(b.ultimo_pedido).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case "total-gasto":
        filtered.sort((a, b) => (b.total_gasto || 0) - (a.total_gasto || 0));
        break;
      case "total-pedidos":
        filtered.sort((a, b) => (b.total_pedidos || 0) - (a.total_pedidos || 0));
        break;
    }

    return filtered;
  }, [clientes, searchTerm, statusFilter, sortBy]);

  const hasActiveFilters = statusFilter !== "todos";

  return (
    <div className="w-full bg-white border-r border-[#E5E7EB] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E7EB] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-[#111827]">Clientes</h2>
          <span className="text-xs text-[#6B7280] bg-[#F8F9FC] px-2 py-1 rounded-lg">
            {clientesFiltrados.length} clientes
          </span>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input aria-label="Buscar clientes"
            placeholder="Buscar por nome, telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-[#F8F9FC] border-[#E5E7EB]"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="p-4 border-b border-[#E5E7EB] space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] uppercase">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
          {hasActiveFilters && (
            <button
              onClick={() => setStatusFilter("todos")}
              className="ml-auto text-[#C8285F] hover:text-[#E33E70]"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Status */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            <SelectItem value="novo">Novos</SelectItem>
            <SelectItem value="frequente">Frequentes</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>

        {/* Ordenação */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome">Nome (A-Z)</SelectItem>
            <SelectItem value="ultimo-pedido">Último pedido</SelectItem>
            <SelectItem value="total-gasto">Valor gasto</SelectItem>
            <SelectItem value="total-pedidos">Quantidade de pedidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Clientes */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {clientesFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[#6B7280] mb-2">
                Nenhum cliente encontrado
              </p>
            </div>
          ) : (
            clientesFiltrados.map((cliente) => (
              <ClienteListItem
                key={cliente.id}
                cliente={cliente}
                isSelected={cliente.id === selectedId}
                onClick={() => onSelect(cliente)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
