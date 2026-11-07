"use client";

import { useState, useMemo } from "react";
import { Produto, Categoria } from "@/types/produto";
import { ProdutoListItem } from "./ProdutoListItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, SlidersHorizontal } from "lucide-react";
import { NovoProdutoDialog } from "./NovoProdutoDialog";

interface ProdutoListProps {
  produtos: Produto[];
  categorias: Categoria[];
  selectedId?: string | number;
  onSelect: (produto: Produto) => void;
}

export function ProdutoList({
  produtos,
  categorias,
  selectedId,
  onSelect,
}: ProdutoListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("todos");
  const [disponibilidadeFilter, setDisponibilidadeFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<string>("nome");
  const [showNovoProduto, setShowNovoProduto] = useState(false);

  const produtosFiltrados = useMemo(() => {
    let filtered = [...produtos];

    // Filtro de pesquisa
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.nome.toLowerCase().includes(term) ||
          p.descricao?.toLowerCase().includes(term) ||
          p.categoria?.nome.toLowerCase().includes(term)
      );
    }

    // Filtro de categoria
    if (categoriaFilter !== "todos") {
      filtered = filtered.filter((p) => p.categoria_id === categoriaFilter);
    }

    // Filtro de disponibilidade
    if (disponibilidadeFilter === "disponiveis") {
      filtered = filtered.filter((p) => p.esta_disponivel);
    } else if (disponibilidadeFilter === "indisponiveis") {
      filtered = filtered.filter((p) => !p.esta_disponivel);
    } else if (disponibilidadeFilter === "sem-imagem") {
      filtered = filtered.filter((p) => !p.imagem_url);
    }

    // Ordenação
    switch (sortBy) {
      case "nome":
        filtered.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case "preco-asc":
        filtered.sort((a, b) => a.preco_base - b.preco_base);
        break;
      case "preco-desc":
        filtered.sort((a, b) => b.preco_base - a.preco_base);
        break;
      case "categoria":
        filtered.sort((a, b) =>
          (a.categoria?.nome || "").localeCompare(b.categoria?.nome || "")
        );
        break;
      case "ordem":
        filtered.sort((a, b) => a.ordem - b.ordem);
        break;
    }

    return filtered;
  }, [produtos, searchTerm, categoriaFilter, disponibilidadeFilter, sortBy]);

  const hasActiveFilters = categoriaFilter !== "todos" || disponibilidadeFilter !== "todos";

  return (
    <>
      <div className="w-[340px] bg-white border-r border-[#E5E7EB] flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E7EB] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-[#111827]">Produtos</h2>
            <span className="text-xs text-[#6B7280] bg-[#F8F9FC] px-2 py-1 rounded-lg">
              {produtosFiltrados.length} produtos
            </span>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-[#F8F9FC] border-[#E5E7EB]"
            />
          </div>

          {/* Novo Produto */}
          <Button
            onClick={() => setShowNovoProduto(true)}
            className="w-full bg-[#C8285F] hover:bg-[#E33E70] h-10"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-[#E5E7EB] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] uppercase">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setCategoriaFilter("todos");
                  setDisponibilidadeFilter("todos");
                }}
                className="ml-auto text-[#C8285F] hover:text-[#E33E70]"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Categoria */}
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Disponibilidade */}
          <Select
            value={disponibilidadeFilter}
            onValueChange={setDisponibilidadeFilter}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Disponibilidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="disponiveis">Disponíveis</SelectItem>
              <SelectItem value="indisponiveis">Indisponíveis</SelectItem>
              <SelectItem value="sem-imagem">Sem imagem</SelectItem>
            </SelectContent>
          </Select>

          {/* Ordenação */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
              <SelectItem value="preco-asc">Menor preço</SelectItem>
              <SelectItem value="preco-desc">Maior preço</SelectItem>
              <SelectItem value="categoria">Categoria</SelectItem>
              <SelectItem value="ordem">Ordem</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Produtos */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {produtosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[#6B7280] mb-2">
                  Nenhum produto encontrado
                </p>
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                  >
                    Limpar busca
                  </Button>
                )}
              </div>
            ) : (
              produtosFiltrados.map((produto) => (
                <ProdutoListItem
                  key={produto.id}
                  produto={produto}
                  isSelected={String(produto.id) === String(selectedId)}
                  onClick={() => onSelect(produto)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Dialog Novo Produto */}
      <NovoProdutoDialog
        open={showNovoProduto}
        onOpenChange={setShowNovoProduto}
        categorias={categorias}
      />
    </>
  );
}
