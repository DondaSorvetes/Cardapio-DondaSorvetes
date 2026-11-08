"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { CatalogTab } from "./types";

/** Áreas do catálogo, na ordem do fluxo de trabalho. */
const TABS: { id: CatalogTab; label: string }[] = [
  { id: "produtos", label: "Produtos" },
  { id: "complementos", label: "Complementos" },
  { id: "opcoes", label: "Opções" },
  { id: "combos", label: "Combos" },
  { id: "promocoes", label: "Promoções" },
];

export function CatalogoTabs({
  active,
  onChange,
}: {
  active: CatalogTab;
  onChange: (tab: CatalogTab) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  // Mantém a aba ativa visível quando a barra rola na horizontal (celular).
  useEffect(() => {
    const nav = navRef.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!nav || !tab) return;
    const left = tab.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft || left + tab.offsetWidth > nav.scrollLeft + nav.clientWidth)
      nav.scrollTo({ left: Math.max(0, left - 16) });
  }, [active]);
  return (
    <div className="catalog-tabs">
      <nav ref={navRef} aria-label="Áreas do catálogo" role="tablist">
        {TABS.map(({ id, label }, index) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight" ? (index + 1) % TABS.length
                  : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length
                  : event.key === "Home" ? 0
                  : event.key === "End" ? TABS.length - 1
                  : -1;
                if (next < 0) return;
                event.preventDefault();
                onChange(TABS[next].id);
                const target =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  )[next];
                target?.focus();
                target?.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
              onClick={() => onChange(id)}
              className={cn("catalog-tab", isActive && "is-active")}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
