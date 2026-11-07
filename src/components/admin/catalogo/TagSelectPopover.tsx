"use client";

import { useEffect, useState } from "react";
import { Check, Tag, X } from "lucide-react";
import { listTags, type TagRow } from "@/actions/admin/tags";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CatalogTagBadge } from "./CatalogTagBadge";

/**
 * Seletor compacto de tag (uma por item) para opções e grupos.
 * Mostra a tag atual como o cliente vê; clique abre a lista.
 */
export function TagSelectPopover({
  value,
  tag,
  onChange,
  disabled,
  placeholder = "Tag",
  size = "sm",
}: {
  /** tag_id atual */
  value?: string | number | null;
  /** objeto tag já resolvido (preferencial para exibir cores) */
  tag?: {
    id?: string | number;
    nome: string;
    cor_fundo?: string | null;
    cor_texto?: string | null;
  } | null;
  onChange: (tagId: string | null, tag: TagRow | null) => void;
  disabled?: boolean;
  placeholder?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void listTags()
      .then((data) => {
        if (!cancelled) setTags(data);
      })
      .catch(() => {
        if (!cancelled) setTags([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedId = value != null && value !== "" ? String(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border transition-colors max-w-[140px]",
            size === "sm" ? "h-7 px-1.5 text-[10px]" : "h-8 px-2 text-xs",
            tag
              ? "border-transparent hover:opacity-90"
              : "border-dashed border-[#F6BFD2] text-[#6B7280] hover:bg-[#FDF0F4] hover:text-[#C8285F]",
            disabled && "opacity-50 pointer-events-none"
          )}
          title={tag ? `Tag: ${tag.nome}` : "Atribuir tag (visível no cardápio)"}
        >
          {tag ? (
            <>
              <CatalogTagBadge tag={tag} size="sm" />
            </>
          ) : (
            <>
              <Tag className="w-3 h-3 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 p-2 rounded-xl border-[#E5E7EB] shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] px-2 mb-1.5">
          Tag no cardápio
        </p>
        {loading ? (
          <p className="text-xs text-[#9CA3AF] px-2 py-3">Carregando…</p>
        ) : (
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange(null, null);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left",
                !selectedId
                  ? "bg-[#FDF0F4] text-[#C8285F] font-semibold"
                  : "hover:bg-[#F7F8FC] text-[#6B7280]"
              )}
            >
              <X className="w-3.5 h-3.5" />
              Sem tag
            </button>
            {tags.map((t) => {
              const active = selectedId === String(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onChange(String(t.id), t);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left",
                    active ? "bg-[#F8F5FC] ring-1 ring-[#F6BFD2]" : "hover:bg-[#F7F8FC]"
                  )}
                >
                  <CatalogTagBadge tag={t} />
                  {active && (
                    <Check className="w-3.5 h-3.5 text-[#C8285F] ml-auto shrink-0" />
                  )}
                </button>
              );
            })}
            {tags.length === 0 && (
              <p className="text-[11px] text-[#9CA3AF] px-2 py-2">
                Nenhuma tag. Crie em Produto → Tags.
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
