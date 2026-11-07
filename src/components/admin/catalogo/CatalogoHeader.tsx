"use client";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { CatalogTab } from "./types";

/** Ação principal de cada aba; Complementos/Opções criam dentro da própria tela. */
const PRIMARY: Partial<Record<CatalogTab, string>> = {
  produtos: "Novo produto",
  combos: "Novo combo",
  promocoes: "Nova campanha",
};

export function CatalogoHeader({
  activeTab,
  onPrimary,
  onImport,
  onExport,
}: {
  activeTab: CatalogTab;
  onPrimary: () => void;
  onImport?: () => void;
  onExport?: () => void;
}) {
  const primary = PRIMARY[activeTab];
  return (
    <header className="catalog-heading">
      <h1>Catálogo</h1>
      <div className="catalog-heading-actions">
        {activeTab === "produtos" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="catalog-secondary-action" aria-label="Mais ações do catálogo">
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onImport}>Importar</DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>Exportar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {primary && (
          <button type="button" onClick={onPrimary} className="catalog-primary-action" aria-label={primary}>
            <Plus size={16} aria-hidden="true" />
            <span className="catalog-primary-label">{primary}</span>
            <span className="catalog-primary-label-short" aria-hidden="true">
              Novo
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
