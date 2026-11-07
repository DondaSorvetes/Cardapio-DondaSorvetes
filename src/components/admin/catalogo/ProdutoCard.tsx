"use client";

import { cn } from "@/lib/utils";
import { CatalogTagBadge } from "./CatalogTagBadge";
import { ProdutoActionsMenu, type ProdutoActions } from "./ProdutoActionsMenu";
import { DisponibilidadeSwitch, ProdutoPreco, ProdutoThumb } from "./ProdutoRow";
import { isProdutoDisponivel, type CatalogProduto } from "./types";

/** Visualização em grade: foto em destaque, como no cardápio do cliente. */
export function ProdutoCard({
  produto,
  ...actions
}: ProdutoActions & { produto: CatalogProduto }) {
  const disponivel = isProdutoDisponivel(produto);
  return (
    <li className={cn("catalog-card", !disponivel && "is-paused")}>
      <button
        type="button"
        onClick={actions.onEdit}
        className="catalog-card-media"
        aria-label={`Editar ${produto.nome}`}
      >
        <ProdutoThumb
          produto={produto}
          className="catalog-card-thumb"
          sizes="(max-width: 639px) 50vw, 240px"
        />
        {produto.tag?.nome ? (
          <span className="catalog-card-tag">
            <CatalogTagBadge tag={produto.tag} />
          </span>
        ) : null}
      </button>
      <div className="catalog-card-body">
        <button type="button" onClick={actions.onEdit} className="catalog-card-title">
          {produto.nome}
        </button>
        <span className="catalog-card-category">
          {produto.categoria?.nome || "Sem categoria"}
        </span>
        <ProdutoPreco produto={produto} />
      </div>
      <div className="catalog-card-footer">
        <DisponibilidadeSwitch produto={produto} onToggle={actions.onToggleDisponivel} />
        <ProdutoActionsMenu nome={produto.nome} disponivel={disponivel} {...actions} />
      </div>
    </li>
  );
}
