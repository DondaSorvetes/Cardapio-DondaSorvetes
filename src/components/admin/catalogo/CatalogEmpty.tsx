"use client";

import { Package, FolderOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyKind =
  | "catalogo"
  | "produtos"
  | "categorias"
  | "busca"
  | "complementos"
  | "coming";

const COPY: Record<
  EmptyKind,
  { icon: typeof Package; title: string; description: string }
> = {
  catalogo: {
    icon: Package,
    title: "Seu catálogo está vazio",
    description: "Adicione o primeiro produto ao seu cardápio.",
  },
  produtos: {
    icon: Package,
    title: "Nenhum produto nesta categoria",
    description: "Crie o primeiro produto ou escolha outra categoria.",
  },
  categorias: {
    icon: FolderOpen,
    title: "Nenhuma categoria ainda",
    description: "Organize o cardápio criando categorias.",
  },
  busca: {
    icon: Package,
    title: "Nenhum resultado",
    description: "Tente outro termo ou filtro.",
  },
  complementos: {
    icon: Layers,
    title: "Nenhum grupo de complementos",
    description: "Crie grupos como Caldas, Frutas e Coberturas.",
  },
  coming: {
    icon: Package,
    title: "Em breve",
    description: "Esta área ainda está em desenvolvimento.",
  },
};

export function CatalogEmpty({
  kind,
  actionLabel,
  onAction,
  className,
}: {
  kind: EmptyKind;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const cfg = COPY[kind];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-7 px-5",
        className
      )}
    >
      <div className="w-10 h-10 rounded-md bg-[#F3F4F6] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#9CA3AF]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[#111827] mb-1">
        {cfg.title}
      </h3>
      <p className="text-[13px] text-[#6B7280] max-w-sm mb-4 leading-relaxed">
        {cfg.description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-8 px-3 rounded-md bg-[#C8285F] text-white text-[12px] font-medium hover:bg-[#A51F50]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
