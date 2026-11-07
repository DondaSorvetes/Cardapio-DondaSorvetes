"use client";

import type { Category } from "@/data/tipos";
import { cn } from "@/lib/utils";

type CategoryBarProps = {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
};

export function CategoryBar({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryBarProps) {
  const chip = (selected: boolean) =>
    cn(
      "max-w-[70vw] shrink-0 truncate rounded-full px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      selected
        ? "bg-primary text-primary-foreground shadow-sm"
        : "bg-muted text-foreground/75 hover:bg-primary/10 hover:text-primary",
    );

  return (
    <div>
      {categories.length > 0 ? (
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0"
          role="group"
          aria-label="Filtrar por categoria"
        >
          <button type="button" onClick={() => onSelectCategory(null)} aria-pressed={selectedCategoryId === null} className={chip(selectedCategoryId === null)}>
            Todos
          </button>
          {categories.map((category) => {
            const selected = selectedCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                aria-pressed={selected}
                className={chip(selected)}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma categoria disponível.</p>
      )}
    </div>
  );
}
