"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Package } from "lucide-react";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { cn } from "@/lib/utils";
import { useImagemAssinada } from "@/hooks/useImagemAssinada";
import { Switch } from "@/components/ui/switch";
import { CatalogTagBadge } from "./CatalogTagBadge";
import {
  ProdutoActionsMenu,
  descontoPercentual,
  type ProdutoActions,
} from "./ProdutoActionsMenu";
import {
  formatBRL,
  hasPrecoPromocional,
  isProdutoDisponivel,
  type CatalogProduto,
} from "./types";

type ProdutoRowProps = ProdutoActions & {
  produto: CatalogProduto;
  enableDnd?: boolean;
  toggling?: boolean;
  /** Mostra a categoria sob o nome (visão "Todos os produtos"). */
  showCategoria?: boolean;
};

export function ProdutoRow(props: ProdutoRowProps) {
  if (props.enableDnd) return <ProdutoRowSortable {...props} />;
  return <ProdutoRowInner {...props} />;
}

function ProdutoRowSortable(props: ProdutoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(props.produto.id) });
  return (
    <ProdutoRowInner
      {...props}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

/** Miniatura do produto com fallback; reaproveitada pela grade. */
export function ProdutoThumb({
  produto,
  className,
  sizes,
}: {
  produto: CatalogProduto;
  className?: string;
  sizes: string;
}) {
  const imgUrl = useImagemAssinada(produto.imagem_url);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className={cn("catalog-thumb", className)}>
      {imgUrl && imgUrl !== failedUrl ? (
        <Image
          src={imgUrl}
          onError={() => setFailedUrl(imgUrl)}
          alt=""
          fill
          className="object-cover"
          sizes={sizes}
        />
      ) : (
        <Package className="h-5 w-5" aria-hidden="true" />
      )}
    </div>
  );
}

export function ProdutoPreco({ produto }: { produto: CatalogProduto }) {
  const promo = hasPrecoPromocional(produto);
  const desconto = promo
    ? descontoPercentual(Number(produto.preco_base), Number(produto.preco_promocional))
    : null;
  return (
    <div className="catalog-price">
      <span className="catalog-price-current">
        {formatBRL(promo ? produto.preco_promocional : produto.preco_base)}
      </span>
      {promo && (
        <span className="catalog-price-meta">
          <s>{formatBRL(produto.preco_base)}</s>
          {desconto ? <span className="catalog-discount">-{desconto}%</span> : null}
        </span>
      )}
    </div>
  );
}

export function DisponibilidadeSwitch({
  produto,
  disabled,
  onToggle,
  showLabel = true,
}: {
  produto: CatalogProduto;
  disabled?: boolean;
  onToggle: () => void;
  showLabel?: boolean;
}) {
  const disponivel = isProdutoDisponivel(produto);
  return (
    <label className="catalog-availability">
      <Switch
        checked={disponivel}
        disabled={disabled}
        onCheckedChange={() => onToggle()}
        className="h-5 w-9 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-[#D4D0DA] [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
        aria-label={`${disponivel ? "Pausar" : "Retomar"} vendas de ${produto.nome}`}
      />
      {showLabel && (
        <span className={cn("catalog-status-text", disponivel ? "is-on" : "is-off")}>
          {disponivel ? "À venda" : "Pausado"}
        </span>
      )}
    </label>
  );
}

function ProdutoRowInner({
  produto,
  onEdit,
  onDuplicate,
  onView,
  onDelete,
  onToggleDisponivel,
  setNodeRef,
  style,
  isDragging,
  dragHandleProps,
  toggling = false,
  showCategoria = false,
}: ProdutoRowProps & {
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const disponivel = isProdutoDisponivel(produto);
  const subtitulo = [
    showCategoria ? produto.categoria?.nome || "Sem categoria" : null,
    produto.codigo ? `Cód. ${produto.codigo}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr
      ref={setNodeRef as unknown as React.Ref<HTMLTableRowElement>}
      style={style}
      className={cn(
        "catalog-product-row",
        isDragging && "is-dragging",
        !disponivel && "is-paused",
      )}
    >
      <td className="catalog-cell-drag">
        {dragHandleProps ? (
          <button
            type="button"
            className="catalog-drag-handle"
            aria-label={`Arrastar ${produto.nome}`}
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </td>

      <td className="catalog-product-cell">
        <button type="button" onClick={onEdit} className="catalog-product-main">
          <ProdutoThumb produto={produto} sizes="52px" />
          <span className="catalog-product-text">
            <span className="catalog-product-title">
              <span className="catalog-product-name">{produto.nome}</span>
              <CatalogTagBadge tag={produto.tag} />
              {!disponivel && <span className="catalog-paused-pill">Pausado</span>}
            </span>
            {subtitulo ? <span className="catalog-product-desc">{subtitulo}</span> : null}
          </span>
        </button>
      </td>

      <td className="catalog-product-price">
        <ProdutoPreco produto={produto} />
      </td>

      <td className="catalog-product-availability">
        <DisponibilidadeSwitch
          produto={produto}
          disabled={toggling}
          onToggle={onToggleDisponivel}
          showLabel={false}
        />
      </td>

      <td className="catalog-product-actions">
        <ProdutoActionsMenu
          nome={produto.nome}
          disponivel={disponivel}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onView={onView}
          onDelete={onDelete}
          onToggleDisponivel={onToggleDisponivel}
        />
      </td>
    </tr>
  );
}
