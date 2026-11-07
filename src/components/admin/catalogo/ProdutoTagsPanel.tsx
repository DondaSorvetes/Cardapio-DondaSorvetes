"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Tag, Trash2, Check, Wand2 } from "lucide-react";
import {
  listTags,
  createTag,
  deleteTag,
  updateTag,
  type TagRow,
} from "@/actions/admin/tags";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TAG_ICONES,
  TAG_ICONE_KEYS,
  TagIcone,
  resolverTagIcone,
  type TagIconeKey,
} from "@/components/ui/TagIcone";
import { cn } from "@/lib/utils";

type Sugestao = {
  nome: string;
  cor_fundo: string;
  cor_texto: string;
  icone: TagIconeKey;
};

/** Sugestões ao criar tag: nome, cores e ícone prontos. */
const SUGESTOES: Sugestao[] = [
  { nome: "Mais vendidos", cor_fundo: "#EF4444", cor_texto: "#FFFFFF", icone: "mais_vendido" },
  { nome: "Promoção", cor_fundo: "#EF4444", cor_texto: "#FFFFFF", icone: "promocao" },
  { nome: "Ofertas da casa", cor_fundo: "#F97316", cor_texto: "#FFFFFF", icone: "oferta" },
  { nome: "Mais pedido", cor_fundo: "#DC2626", cor_texto: "#FFFFFF", icone: "mais_pedido" },
  { nome: "Novidade", cor_fundo: "#E33E70", cor_texto: "#FFFFFF", icone: "novidade" },
  { nome: "Favoritas da casa", cor_fundo: "#E11D48", cor_texto: "#FFFFFF", icone: "favorito" },
  { nome: "Premium", cor_fundo: "#F59E0B", cor_texto: "#000000", icone: "premium" },
  { nome: "Recomendado", cor_fundo: "#C8285F", cor_texto: "#FFFFFF", icone: "recomendado" },
  { nome: "Escolha do chef", cor_fundo: "#111827", cor_texto: "#FFFFFF", icone: "chef" },
  { nome: "Por tempo limitado", cor_fundo: "#0284C7", cor_texto: "#FFFFFF", icone: "limitado" },
  { nome: "Oferta relâmpago", cor_fundo: "#FACC15", cor_texto: "#000000", icone: "rapido" },
  { nome: "10% Cashback", cor_fundo: "#16A34A", cor_texto: "#FFFFFF", icone: "cashback" },
  { nome: "Frete grátis", cor_fundo: "#059669", cor_texto: "#FFFFFF", icone: "frete" },
  { nome: "Combo da galera", cor_fundo: "#EA580C", cor_texto: "#FFFFFF", icone: "combo" },
  { nome: "Ganhe um brinde", cor_fundo: "#DB2777", cor_texto: "#FFFFFF", icone: "presente" },
  { nome: "Vegano", cor_fundo: "#15803D", cor_texto: "#FFFFFF", icone: "vegano" },
  { nome: "Saudável", cor_fundo: "#65A30D", cor_texto: "#FFFFFF", icone: "saudavel" },
  { nome: "Fit", cor_fundo: "#0891B2", cor_texto: "#FFFFFF", icone: "fit" },
  { nome: "Sem lactose", cor_fundo: "#2563EB", cor_texto: "#FFFFFF", icone: "sem_lactose" },
  { nome: "Sem glúten", cor_fundo: "#A16207", cor_texto: "#FFFFFF", icone: "sem_gluten" },
  { nome: "Kids", cor_fundo: "#EC4899", cor_texto: "#FFFFFF", icone: "kids" },
  { nome: "Gelado", cor_fundo: "#38BDF8", cor_texto: "#000000", icone: "gelado" },
  { nome: "Shake da semana", cor_fundo: "#A855F7", cor_texto: "#FFFFFF", icone: "sorvete" },
  { nome: "Destaque", cor_fundo: "#C8285F", cor_texto: "#FFFFFF", icone: "destaque" },
];

const COLOR_SWATCHES = [
  { cor_fundo: "#EF4444", cor_texto: "#FFFFFF" },
  { cor_fundo: "#F97316", cor_texto: "#FFFFFF" },
  { cor_fundo: "#F59E0B", cor_texto: "#000000" },
  { cor_fundo: "#16A34A", cor_texto: "#FFFFFF" },
  { cor_fundo: "#0284C7", cor_texto: "#FFFFFF" },
  { cor_fundo: "#E33E70", cor_texto: "#FFFFFF" },
  { cor_fundo: "#C8285F", cor_texto: "#FFFFFF" },
  { cor_fundo: "#E11D48", cor_texto: "#FFFFFF" },
  { cor_fundo: "#111827", cor_texto: "#FFFFFF" },
  { cor_fundo: "#FDF0F4", cor_texto: "#C8285F" },
  { cor_fundo: "#FEF3C7", cor_texto: "#B45309" },
  { cor_fundo: "#F3F4F6", cor_texto: "#374151" },
];

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Grade de ícones; `null` = automático pelo nome. */
function IconePicker({
  nome,
  value,
  onChange,
  cor,
  corSimbolo,
  disabled,
}: {
  nome: string;
  value: TagIconeKey | null;
  onChange: (icone: TagIconeKey | null) => void;
  cor: string;
  corSimbolo: string;
  disabled?: boolean;
}) {
  const auto = resolverTagIcone(nome);
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ícone da tag">
      <button
        type="button"
        role="radio"
        aria-checked={value == null}
        disabled={disabled}
        title={`Automático pelo nome (${TAG_ICONES[auto].label})`}
        onClick={() => onChange(null)}
        className={cn(
          "inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors",
          value == null
            ? "border-[#C8285F] bg-[#FDF0F4] text-[#C8285F]"
            : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#F6BFD2]",
        )}
      >
        <Wand2 className="h-3.5 w-3.5" />
        Auto
      </button>
      {TAG_ICONE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={TAG_ICONES[key].label}
          title={TAG_ICONES[key].label}
          disabled={disabled}
          onClick={() => onChange(key)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
            value === key
              ? "border-[#C8285F] bg-[#FDF0F4] ring-2 ring-[#C8285F]/20"
              : "border-[#E5E7EB] bg-white hover:border-[#F6BFD2]",
          )}
        >
          <TagIcone nome={nome} icone={key} cor={cor} corSimbolo={corSimbolo} />
        </button>
      ))}
    </div>
  );
}

/**
 * Seleção de tag do produto (FK `produtos.tag_id`) + criação de novas tags.
 * O schema atual permite **uma** tag por produto.
 */
export function ProdutoTagsPanel({
  selectedTagId,
  onChange,
  readOnly = false,
}: {
  selectedTagId: string | null;
  onChange: (tagId: string | null) => void;
  readOnly?: boolean;
}) {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newFundo, setNewFundo] = useState("#EF4444");
  const [newTexto, setNewTexto] = useState("#FFFFFF");
  const [newIcone, setNewIcone] = useState<TagIconeKey | null>(null);
  const [editandoIcone, setEditandoIcone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTags();
      setTags(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Sugestões que ainda não existem, filtradas pelo que o admin digitou. */
  const sugestoes = useMemo(() => {
    const existentes = new Set(tags.map((t) => normalizar(t.nome)));
    const busca = normalizar(newNome);
    return SUGESTOES.filter(
      (s) =>
        !existentes.has(normalizar(s.nome)) &&
        (!busca ||
          normalizar(s.nome).includes(busca) ||
          normalizar(TAG_ICONES[s.icone].label).includes(busca)),
    );
  }, [tags, newNome]);

  const selectedTag = tags.find((t) => String(t.id) === selectedTagId) ?? null;

  const selectTag = (id: string) => {
    if (readOnly) return;
    setEditandoIcone(false);
    if (selectedTagId === id) {
      onChange(null);
    } else {
      onChange(id);
    }
  };

  const aplicarSugestao = (s: Sugestao) => {
    setNewNome(s.nome);
    setNewFundo(s.cor_fundo);
    setNewTexto(s.cor_texto);
    setNewIcone(s.icone);
  };

  const fecharCriacao = () => {
    setCreating(false);
    setNewNome("");
    setNewIcone(null);
  };

  const handleCreate = async () => {
    if (!newNome.trim() || readOnly) return;
    setBusy(true);
    try {
      const tag = await createTag({
        nome: newNome.trim(),
        cor_fundo: newFundo,
        cor_texto: newTexto,
        icone: newIcone,
      });
      setTags((prev) => {
        if (prev.some((t) => t.id === tag.id)) return prev;
        return [...prev, tag].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR"),
        );
      });
      onChange(String(tag.id));
      fecharCriacao();
      toast.success("Tag criada e selecionada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar tag");
    } finally {
      setBusy(false);
    }
  };

  const handleIconeExistente = async (icone: TagIconeKey | null) => {
    if (!selectedTag || readOnly) return;
    setBusy(true);
    try {
      const tag = await updateTag(selectedTag.id, { icone });
      setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, ...tag } : t)));
      toast.success("Ícone atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao trocar ícone");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (tag: TagRow) => {
    if (readOnly) return;
    if (
      !confirm(`Excluir a tag “${tag.nome}”? Produtos com ela ficarão sem tag.`)
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteTag(tag.id);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
      if (selectedTagId === String(tag.id)) onChange(null);
      toast.success("Tag excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-[#9CA3AF] text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando tags…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[#111827]">Tag do produto</p>
        <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
          Mini tag no produto (ex.: Mais vendido, Novidade, Promoção). Clique
          de novo na tag selecionada para remover. Qual tag fica no topo do
          cardápio é escolhido em “Topo do cardápio”, na lista de produtos.
        </p>
      </div>

      {selectedTag && (
        <div className="rounded-lg bg-[#FDF0F4] px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-[#C8285F]">
              1 tag selecionada — aparece no cardápio e na lista do admin
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setEditandoIcone((v) => !v)}
                className="shrink-0 text-[11px] font-semibold text-[#C8285F] underline-offset-2 hover:underline"
              >
                {editandoIcone ? "Fechar" : "Trocar ícone"}
              </button>
            )}
          </div>
          {editandoIcone && !readOnly && (
            <IconePicker
              nome={selectedTag.nome}
              value={
                selectedTag.icone && selectedTag.icone in TAG_ICONES
                  ? (selectedTag.icone as TagIconeKey)
                  : null
              }
              onChange={(icone) => void handleIconeExistente(icone)}
              cor={selectedTag.cor_fundo}
              corSimbolo={selectedTag.cor_texto || "#FFFFFF"}
              disabled={busy}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange(null)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
            selectedTagId == null
              ? "border-[#C8285F] bg-[#FDF0F4] text-[#C8285F] ring-2 ring-[#C8285F]/20"
              : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#F6BFD2]",
          )}
        >
          Sem tag
        </button>

        {tags.map((tag) => {
          const selected = selectedTagId === String(tag.id);
          return (
            <div key={tag.id} className="relative group/tag">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => selectTag(String(tag.id))}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border transition-all",
                  selected
                    ? "ring-2 ring-[#C8285F]/35 border-transparent scale-[1.02]"
                    : "border-transparent hover:opacity-90",
                )}
                style={{
                  backgroundColor: tag.cor_fundo,
                  color: tag.cor_texto || "#111827",
                }}
              >
                {selected ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <TagIcone nome={tag.nome} icone={tag.icone} variante="glifo" />
                )}
                {tag.nome}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  title="Excluir tag"
                  onClick={() => void handleDelete(tag)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-[#E5E7EB] text-red-500 flex items-center justify-center shadow-sm"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {tags.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] p-4 text-center">
          <Tag className="w-6 h-6 text-[#9CA3AF] mx-auto mb-2" />
          <p className="text-xs text-[#6B7280]">
            Nenhuma tag ainda. Crie a sua ou escolha uma sugestão.
          </p>
        </div>
      )}

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
              Criar nova tag
            </Button>
          ) : (
            <>
              <p className="text-xs font-semibold text-[#C8285F]">Nova tag</p>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Nome</Label>
                <Input
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  placeholder="Ex.: Mais vendidos, Promoção, Vegano…"
                  className="h-9 rounded-lg text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreate();
                    }
                  }}
                />
              </div>

              {sugestoes.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Sugestões</Label>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
                    {sugestoes.map((s) => (
                      <button
                        key={s.nome}
                        type="button"
                        onClick={() => aplicarSugestao(s)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-90",
                          normalizar(newNome) === normalizar(s.nome) &&
                            "ring-2 ring-[#C8285F]/35",
                        )}
                        style={{ backgroundColor: s.cor_fundo, color: s.cor_texto }}
                      >
                        <TagIcone nome={s.nome} icone={s.icone} variante="glifo" />
                        {s.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[11px]">Cores</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_SWATCHES.map((c) => {
                    const active =
                      newFundo === c.cor_fundo && newTexto === c.cor_texto;
                    return (
                      <button
                        key={c.cor_fundo + c.cor_texto}
                        type="button"
                        onClick={() => {
                          setNewFundo(c.cor_fundo);
                          setNewTexto(c.cor_texto);
                        }}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-transform",
                          active
                            ? "border-[#C8285F] scale-110"
                            : "border-white shadow-sm",
                        )}
                        style={{ backgroundColor: c.cor_fundo }}
                        title={c.cor_fundo}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px]">Ícone</Label>
                <IconePicker
                  nome={newNome}
                  value={newIcone}
                  onChange={setNewIcone}
                  cor={newFundo}
                  corSimbolo={newTexto}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px]">Prévia</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: newFundo, color: newTexto }}
                  >
                    <TagIcone nome={newNome} icone={newIcone} variante="glifo" />
                    {newNome.trim() || "Prévia"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold uppercase text-[#111827]">
                    <TagIcone
                      nome={newNome}
                      icone={newIcone}
                      cor={newFundo}
                      corSimbolo={newTexto}
                    />
                    {newNome.trim() || "Título no cardápio"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={fecharCriacao}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !newNome.trim()}
                  className="flex-1 rounded-lg bg-[#C8285F] hover:bg-[#E33E70]"
                  onClick={() => void handleCreate()}
                >
                  {busy && (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  )}
                  Criar e usar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
