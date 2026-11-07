"use client";

import {
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ProdutoActions = {
  onEdit: () => void;
  onDuplicate: () => void;
  onView: () => void;
  onDelete: () => void;
  onToggleDisponivel: () => void;
};

/** Menu "⋯" compartilhado entre a lista e a grade de produtos. */
export function ProdutoActionsMenu({
  nome,
  disponivel,
  onEdit,
  onDuplicate,
  onView,
  onDelete,
  onToggleDisponivel,
}: ProdutoActions & { nome: string; disponivel: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="catalog-icon-button"
          aria-label={`Ações de ${nome}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 text-[13px]">
        <DropdownMenuItem className="text-[13px]" onClick={onEdit}>
          <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[13px]" onClick={onDuplicate}>
          <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[13px]" onClick={onEdit}>
          <Tag className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Promoção
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[13px]" onClick={onToggleDisponivel}>
          {disponivel ? (
            <>
              <EyeOff className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Pausar vendas
            </>
          ) : (
            <>
              <Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Retomar vendas
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[13px]" onClick={onView}>
          <Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Visualizar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[13px] text-red-600 focus:text-red-600"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Percentual de desconto arredondado, ou null quando não há promoção válida. */
export function descontoPercentual(base: number, promo: number | null | undefined) {
  if (promo == null || !(base > 0) || !(promo > 0) || promo >= base) return null;
  return Math.round((1 - promo / base) * 100);
}
