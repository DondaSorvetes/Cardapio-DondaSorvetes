"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Opcao } from "@/types/adicional";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

interface OpcaoListProps {
  opcoes: Opcao[];
  selectedOpcao: Opcao | null;
  onSelect: (opcao: Opcao) => void;
}

export function OpcaoList({ opcoes, selectedOpcao, onSelect }: OpcaoListProps) {
  if (opcoes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Package className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
          <p className="text-sm text-[#6B7280]">Nenhum adicional encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {opcoes.map((opcao) => {
          const isSelected = selectedOpcao?.id === opcao.id;
          const isAtivo = opcao.status === "ativo";

          return (
            <button
              key={opcao.id}
              onClick={() => onSelect(opcao)}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all duration-200 mb-2 relative",
                isSelected
                  ? "bg-[#FDE6EE] shadow-sm"
                  : "hover:bg-[#F8F9FC]"
              )}
            >
              {/* Barra lateral de seleção */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C8285F] rounded-l-xl" />
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3
                    className={cn(
                      "font-semibold text-sm truncate",
                      isSelected ? "text-[#C8285F]" : "text-[#111827]"
                    )}
                  >
                    {opcao.nome}
                  </h3>
                  <p className="text-xs text-[#6B7280] truncate mt-0.5">
                    {opcao.grupo?.nome || "Sem grupo"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-[#111827]">
                      + R$ {opcao.preco_adicional.toFixed(2).replace(".", ",")}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        isAtivo
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      )}
                    >
                      {isAtivo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
