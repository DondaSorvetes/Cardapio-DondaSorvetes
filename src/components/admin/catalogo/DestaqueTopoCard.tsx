"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { listTags, setTagDestaque, type TagRow } from "@/actions/admin/tags";
import { TagIcone } from "@/components/ui/TagIcone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CatalogProduto } from "./types";

/**
 * Escolhe qual tag ocupa o carrossel do topo do cardápio (só uma por vez).
 * Botão compacto na barra de ferramentas; as opções ficam no menu.
 */
export function DestaqueTopoMenu({ produtos }: { produtos: CatalogProduto[] }) {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTags(await listTags());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Recarrega quando o admin cria/remove tags no painel do produto.
  useEffect(() => {
    if (!loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos]);

  const contagem = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of produtos) {
      if (p.tag_id == null) continue;
      const k = String(p.tag_id);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [produtos]);

  const destaque = tags.find((t) => t.destaque_cardapio) ?? null;

  const escolher = async (value: string) => {
    const id = value === "none" ? null : Number(value);
    if (id === (destaque?.id ?? null)) return;
    setBusy(true);
    try {
      await setTagDestaque(id);
      setTags((prev) => prev.map((t) => ({ ...t, destaque_cardapio: t.id === id })));
      toast.success(
        id == null
          ? "Topo do cardápio sem destaque"
          : `“${tags.find((t) => t.id === id)?.nome}” agora fica no topo do cardápio`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar destaque");
    } finally {
      setBusy(false);
    }
  };

  if (!loading && tags.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="catalog-tool-button"
          disabled={loading || busy}
          aria-label={`Destaque no topo do cardápio: ${destaque?.nome ?? "nenhum"}`}
        >
          {busy || loading ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Star size={15} className="text-[#F59E0B]" fill="currentColor" aria-hidden="true" />
          )}
          <span className="catalog-tool-label">Topo:</span>
          <span className="catalog-tool-value">{destaque?.nome ?? "Nenhum"}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal leading-relaxed text-muted-foreground">
          Tag que aparece em destaque no topo do cardápio. As outras aparecem só como mini tag no produto.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={destaque ? String(destaque.id) : "none"}
          onValueChange={(v) => void escolher(v)}
        >
          <DropdownMenuRadioItem value="none">Nenhum destaque</DropdownMenuRadioItem>
          {tags.map((t) => (
            <DropdownMenuRadioItem key={t.id} value={String(t.id)} className="gap-2">
              <TagIcone
                nome={t.nome}
                icone={t.icone}
                cor={t.cor_fundo}
                corSimbolo={t.cor_texto || "#FFFFFF"}
                className="h-4 w-4"
              />
              <span className="flex-1 truncate">{t.nome}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {contagem.get(String(t.id)) ?? 0}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
