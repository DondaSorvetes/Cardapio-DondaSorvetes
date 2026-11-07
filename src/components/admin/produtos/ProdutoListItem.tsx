"use client";

import { Produto } from "@/types/produto";
import { cn } from "@/lib/utils";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { Package, ImageOff, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProdutoListItemProps {
  produto: Produto;
  isSelected: boolean;
  onClick: () => void;
}

export function ProdutoListItem({
  produto,
  isSelected,
  onClick,
}: ProdutoListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-xl border transition-all duration-200 text-left relative overflow-hidden group",
        isSelected
          ? "bg-[#FDE6EE] border-[#C8285F] shadow-sm"
          : "bg-white border-[#E5E7EB] hover:border-[#C8285F] hover:shadow-sm"
      )}
    >
      {/* Barra lateral roxa quando selecionado */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C8285F]" />
      )}

      <div className={cn("flex gap-3", isSelected && "pl-2")}>
        {/* Imagem */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#F8F9FC] flex-shrink-0 border border-[#E5E7EB]">
          {produto.imagem_url ? (
            <Image
              src={produto.imagem_url}
              alt={produto.nome}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="w-6 h-6 text-[#9CA3AF]" />
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3
              className={cn(
                "font-semibold text-sm truncate",
                isSelected ? "text-[#C8285F]" : "text-[#111827]"
              )}
            >
              {produto.nome}
            </h3>
            {!produto.esta_disponivel && (
              <EyeOff className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
            )}
          </div>

          {/* Categoria */}
          {produto.categoria && (
            <p className="text-xs text-[#6B7280] mb-1.5 truncate">
              {produto.categoria.nome}
            </p>
          )}

          {/* Preço e Status */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#111827]">
              R$ {produto.preco_base.toFixed(2).replace(".", ",")}
            </span>

            <div className="flex items-center gap-1">
              {!produto.esta_disponivel && (
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 h-5 bg-red-50 text-red-700 border-red-200"
                >
                  Oculto
                </Badge>
              )}
              {!produto.imagem_url && (
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200"
                >
                  Sem foto
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
