"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Layers,
  Loader2,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createGrupoOpcoes,
  createOpcaoInGrupo,
  getProdutoGrupoIds,
} from "@/actions/admin/grupos-opcoes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatBRL } from "./types";
import { CatalogTagBadge } from "./CatalogTagBadge";

export type GrupoMini = {
  id: number | string;
  nome: string;
  min_escolha?: number | null;
  max_escolha?: number | null;
  tag?: {
    id?: number | string;
    nome: string;
    cor_fundo?: string | null;
    cor_texto?: string | null;
  } | null;
  opcoes: {
    id: number | string;
    nome: string;
    preco_adicional?: number | null;
    tag?: {
      id?: number | string;
      nome: string;
      cor_fundo?: string | null;
      cor_texto?: string | null;
    } | null;
  }[];
};

/**
 * Seleção de grupos de complementos vinculados a um produto.
 * - Marca/desmarca grupos existentes
 * - Cria grupo novo (+ opções iniciais) e já marca para vincular
 */
export function ProdutoComplementosPanel({
  produtoId,
  selectedGrupoIds,
  onChange,
  readOnly = false,
  /** Quando true, o parent já carregou os vínculos — não sobrescrever */
  skipInitialLinkLoad = false,
}: {
  produtoId?: string | number | null;
  selectedGrupoIds: string[];
  onChange: (ids: string[]) => void;
  readOnly?: boolean;
  skipInitialLinkLoad?: boolean;
}) {
  const [grupos, setGrupos] = useState<GrupoMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [newGrupoNome, setNewGrupoNome] = useState("");
  const [newOpcoesText, setNewOpcoesText] = useState("");
  const [newMin, setNewMin] = useState(0);
  const [newMax, setNewMax] = useState(1);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  const loadGrupos = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: gs }, { data: ops }] = await Promise.all([
        supabase
          .from("grupos_opcoes")
          .select("*, tag:tags(*)")
          .order("nome", { ascending: true }),
        supabase
          .from("opcoes")
          .select(
            "id, nome, preco_adicional, grupo_id, ordem, tag_id, tag:tags(*)"
          )
          .order("ordem", { ascending: true }),
      ]);

      const pickTag = (raw: unknown): GrupoMini["tag"] => {
        if (!raw) return null;
        const t = Array.isArray(raw) ? raw[0] : raw;
        if (!t || typeof t !== "object" || !("nome" in t)) return null;
        const obj = t as {
          id?: number | string;
          nome: string;
          cor_fundo?: string | null;
          cor_texto?: string | null;
        };
        return {
          id: obj.id,
          nome: obj.nome,
          cor_fundo: obj.cor_fundo,
          cor_texto: obj.cor_texto,
        };
      };

      const mapped: GrupoMini[] = (gs || []).map((g) => ({
        id: g.id,
        nome: g.nome,
        min_escolha: g.min_escolha,
        max_escolha: g.max_escolha,
        tag: pickTag((g as { tag?: unknown }).tag),
        opcoes: (ops || [])
          .filter((o) => String(o.grupo_id) === String(g.id))
          .map((o) => ({
            id: o.id,
            nome: o.nome,
            preco_adicional: o.preco_adicional,
            tag: pickTag((o as { tag?: unknown }).tag),
          })),
      }));
      setGrupos(mapped);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Carrega catálogo de grupos
  useEffect(() => {
    void loadGrupos();
  }, [loadGrupos]);

  // Carrega vínculos só se o parent não cuidou disso (evita sobrescrever
  // seleção local e evita apagar ao re-montar a aba).
  useEffect(() => {
    if (skipInitialLinkLoad) return;
    if (produtoId == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const ids = await getProdutoGrupoIds(produtoId);
        if (!cancelled) {
          onChange(ids.map(String));
        }
      } catch {
        // ignore — produto novo ou sem vínculos
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a produtoId
  }, [produtoId, skipInitialLinkLoad]);

  const toggleGrupo = (id: string) => {
    if (readOnly) return;
    if (selectedGrupoIds.includes(id)) {
      onChange(selectedGrupoIds.filter((x) => x !== id));
    } else {
      onChange([...selectedGrupoIds, id]);
    }
  };

  const createAndLink = async () => {
    if (!newGrupoNome.trim() || readOnly) return;
    setBusy(true);
    try {
      const min = Math.max(0, Number(newMin) || 0);
      let max = Math.max(1, Number(newMax) || 1);
      if (max < min) max = min || 1;

      const g = await createGrupoOpcoes({
        nome: newGrupoNome.trim(),
        min_escolha: min,
        max_escolha: max,
      });

      const lines = newOpcoesText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (let i = 0; i < lines.length; i++) {
        // formato "Nome" ou "Nome: 2.50"
        const m = lines[i].match(/^(.+?)(?:\s*[:=]\s*([\d.,]+))?$/);
        const nome = m?.[1]?.trim() || lines[i];
        const preco = m?.[2]
          ? Number(m[2].replace(",", "."))
          : 0;
        await createOpcaoInGrupo({
          grupo_id: g.id,
          nome,
          preco_adicional: Number.isFinite(preco) ? preco : 0,
          ordem: i + 1,
        });
      }

      const gid = String(g.id);
      if (!selectedGrupoIds.includes(gid)) {
        onChange([...selectedGrupoIds, gid]);
      }
      setNewGrupoNome("");
      setNewOpcoesText("");
      setNewMin(0);
      setNewMax(1);
      setCreating(false);
      toast.success("Grupo criado e vinculado ao produto");
      await loadGrupos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar grupo");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-[#9CA3AF] text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando complementos…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[#111827]">
          Complementos deste produto
        </p>
        <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
          Marque os grupos que o cliente poderá escolher neste item (ex.: Caldas,
          Frutas, Tamanho). Você também pode criar um grupo novo só para este
          produto.
        </p>
      </div>

      {selectedGrupoIds.length > 0 && (
        <p className="text-[11px] font-medium text-[#C8285F] bg-[#FDF0F4] rounded-lg px-3 py-2">
          {selectedGrupoIds.length} grupo
          {selectedGrupoIds.length === 1 ? "" : "s"} selecionado
          {selectedGrupoIds.length === 1 ? "" : "s"}
        </p>
      )}

      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {grupos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5E7EB] p-4 text-center text-xs text-[#6B7280]">
            Nenhum grupo cadastrado ainda. Crie o primeiro abaixo.
          </div>
        ) : (
          grupos.map((g) => {
            const id = String(g.id);
            const checked = selectedGrupoIds.includes(id);
            const isOpen = expanded[id];
            const obrigatorio = Number(g.min_escolha || 0) > 0;

            return (
              <div
                key={id}
                className={cn(
                  "rounded-xl border transition-colors",
                  checked
                    ? "border-[#F6BFD2] bg-[#FFF9FA]"
                    : "border-[#E5E7EB] bg-white"
                )}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Checkbox
                    id={`grupo-${id}`}
                    checked={checked}
                    disabled={readOnly}
                    onCheckedChange={() => toggleGrupo(id)}
                    className="data-[state=checked]:bg-[#C8285F] data-[state=checked]:border-[#C8285F]"
                  />
                  <button
                    type="button"
                    className="flex-1 min-w-0 flex items-center gap-2 text-left"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
                    }
                  >
                    <Layers
                      className={cn(
                        "w-4 h-4 shrink-0",
                        checked ? "text-[#C8285F]" : "text-[#9CA3AF]"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">
                          {g.nome}
                        </p>
                        {g.tag && <CatalogTagBadge tag={g.tag} />}
                      </div>
                      <p className="text-[10px] text-[#9CA3AF]">
                        {g.opcoes.length} opção
                        {g.opcoes.length === 1 ? "" : "ões"} ·{" "}
                        {obrigatorio ? "Obrigatório" : "Opcional"} · min{" "}
                        {g.min_escolha ?? 0}/max {g.max_escolha ?? 1}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                    )}
                  </button>
                  {checked && (
                    <Check className="w-4 h-4 text-[#C8285F] shrink-0" />
                  )}
                </div>

                {isOpen && g.opcoes.length > 0 && (
                  <ul className="px-3 pb-2.5 pt-0 space-y-1 border-t border-[#F3F4F6] mx-3 mt-0">
                    {g.opcoes.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 text-xs text-[#6B7280] py-1"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{o.nome}</span>
                          {o.tag && <CatalogTagBadge tag={o.tag} />}
                        </span>
                        <span className="tabular-nums font-medium text-[#374151] shrink-0">
                          {Number(o.preco_adicional || 0) > 0
                            ? `+ ${formatBRL(Number(o.preco_adicional))}`
                            : "incluso"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {isOpen && g.opcoes.length === 0 && (
                  <p className="px-3 pb-2.5 text-[11px] text-[#9CA3AF]">
                    Grupo sem opções ainda. Adicione na aba Complementos.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {!readOnly && (
        <div className="rounded-xl border border-dashed border-[#F6BFD2] bg-[#FFF9FA] p-3 space-y-3">
          {!creating ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-[#F6BFD2] text-[#C8285F] hover:bg-[#FDF0F4]"
              onClick={() => setCreating(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Criar novo grupo de complementos
            </Button>
          ) : (
            <>
              <p className="text-xs font-semibold text-[#C8285F]">
                Novo grupo
              </p>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Nome do grupo</Label>
                <Input
                  value={newGrupoNome}
                  onChange={(e) => setNewGrupoNome(e.target.value)}
                  placeholder="Ex.: Caldas, Frutas, Tamanho"
                  className="h-9 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Mín. escolhas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newMin}
                    onChange={(e) => setNewMin(Number(e.target.value))}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Máx. escolhas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newMax}
                    onChange={(e) => setNewMax(Number(e.target.value))}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">
                  Opções (uma por linha; opcional: Nome: 2,50)
                </Label>
                <textarea
                  value={newOpcoesText}
                  onChange={(e) => setNewOpcoesText(e.target.value)}
                  rows={3}
                  placeholder={"Granola\nMorango: 2,00\nLeite ninho: 3,50"}
                  className="w-full text-sm rounded-lg border border-[#E5E7EB] px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#C8285F]/25"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => {
                    setCreating(false);
                    setNewGrupoNome("");
                    setNewOpcoesText("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !newGrupoNome.trim()}
                  className="flex-1 rounded-lg bg-[#C8285F] hover:bg-[#E33E70]"
                  onClick={() => void createAndLink()}
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                  Criar e vincular
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
