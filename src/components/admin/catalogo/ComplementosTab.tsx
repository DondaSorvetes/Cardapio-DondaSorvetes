"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createGrupoOpcoes,
  updateGrupoOpcoes,
  deleteGrupoOpcoes,
  createOpcaoInGrupo,
} from "@/actions/admin/grupos-opcoes";
import { updateOpcao, deleteOpcao } from "@/actions/admin/adicionais";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CatalogEmpty } from "./CatalogEmpty";
import { CatalogTagBadge } from "./CatalogTagBadge";
import { TagSelectPopover } from "./TagSelectPopover";
import { formatBRL } from "./types";
import type { GrupoOpcoes, Opcao, TagRef } from "@/types/adicional";
import type { TagRow } from "@/actions/admin/tags";

type GrupoComOpcoes = GrupoOpcoes & { opcoes: Opcao[] };

function isOpcaoDisponivel(o: Opcao): boolean {
  if (o.status === "inativo") return false;
  return o.esta_disponivel !== false;
}

function OptionRow({
  opcao,
  enableDnd,
  onRename,
  onPriceChange,
  onTagChange,
  onDelete,
  onToggle,
  toggling,
}: {
  opcao: Opcao;
  enableDnd?: boolean;
  onRename: (nome: string) => void;
  onPriceChange: (preco: number) => void;
  onTagChange: (tagId: string | null, tag: TagRow | null) => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling?: boolean;
}) {
  if (enableDnd) {
    return (
      <OptionRowSortable
        opcao={opcao}
        onRename={onRename}
        onPriceChange={onPriceChange}
        onTagChange={onTagChange}
        onDelete={onDelete}
        onToggle={onToggle}
        toggling={toggling}
      />
    );
  }
  return (
    <OptionRowInner
      opcao={opcao}
      onRename={onRename}
      onPriceChange={onPriceChange}
      onTagChange={onTagChange}
      onDelete={onDelete}
      onToggle={onToggle}
      toggling={toggling}
    />
  );
}

function OptionRowSortable({
  opcao,
  onRename,
  onPriceChange,
  onTagChange,
  onDelete,
  onToggle,
  toggling,
}: {
  opcao: Opcao;
  onRename: (nome: string) => void;
  onPriceChange: (preco: number) => void;
  onTagChange: (tagId: string | null, tag: TagRow | null) => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: `op-${opcao.id}` });
  return (
    <OptionRowInner
      opcao={opcao}
      onRename={onRename}
      onPriceChange={onPriceChange}
      onTagChange={onTagChange}
      onDelete={onDelete}
      onToggle={onToggle}
      toggling={toggling}
      setNodeRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

function OptionRowInner({
  opcao,
  onRename,
  onPriceChange,
  onTagChange,
  onDelete,
  onToggle,
  toggling,
  setNodeRef,
  style,
  dragHandleProps,
}: {
  opcao: Opcao;
  onRename: (nome: string) => void;
  onPriceChange: (preco: number) => void;
  onTagChange: (tagId: string | null, tag: TagRow | null) => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling?: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(opcao.nome);
  const [priceStr, setPriceStr] = useState(
    String(Number(opcao.preco_adicional || 0).toFixed(2)),
  );
  const [editingPrice, setEditingPrice] = useState(false);
  const disponivel = isOpcaoDisponivel(opcao);

  // Sincroniza se o valor vier do servidor/realtime
  useEffect(() => {
    setName(opcao.nome);
    if (!editingPrice) {
      setPriceStr(String(Number(opcao.preco_adicional || 0).toFixed(2)));
    }
  }, [opcao.nome, opcao.preco_adicional, editingPrice]);

  const commitPrice = () => {
    setEditingPrice(false);
    const normalized = priceStr.replace(",", ".").trim();
    const n = Number(normalized);
    if (!Number.isFinite(n) || n < 0) {
      setPriceStr(String(Number(opcao.preco_adicional || 0).toFixed(2)));
      return;
    }
    const rounded = Math.round(n * 100) / 100;
    setPriceStr(rounded.toFixed(2));
    if (rounded !== Number(opcao.preco_adicional || 0)) {
      onPriceChange(rounded);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "catalog-option-row flex flex-wrap items-center gap-2 px-3 py-2 bg-white group",
        !disponivel && "opacity-70 bg-[#FAFAFA]",
      )}
    >
      {dragHandleProps ? (
        <button
          type="button"
          className="text-[#D1D5DB] cursor-grab touch-none"
          aria-label="Arrastar opção"
          {...dragHandleProps}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      ) : (
        <span className="w-3.5" aria-hidden />
      )}
      <div className="basis-[calc(100%-3.5rem)] sm:basis-auto flex-1 min-w-0 flex items-center gap-1.5">
        {editing ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (name.trim() && name !== opcao.nome) onRename(name.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 text-sm flex-1 min-w-0"
          />
        ) : (
          <button
            type="button"
            className="min-w-0 text-left text-sm font-medium text-[#111827] break-words"
            onClick={() => setEditing(true)}
            title="Clique para renomear"
          >
            {opcao.nome}
          </button>
        )}
        {opcao.tag && !editing && <CatalogTagBadge tag={opcao.tag} />}
      </div>

      <TagSelectPopover
        value={opcao.tag_id}
        tag={opcao.tag}
        onChange={onTagChange}
        disabled={toggling}
        placeholder="Tag"
      />

      {/* Preço editável */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-[#9CA3AF] font-medium">R$</span>
        {editingPrice ? (
          <Input
            autoFocus
            type="text"
            inputMode="decimal"
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setPriceStr(
                  String(Number(opcao.preco_adicional || 0).toFixed(2)),
                );
                setEditingPrice(false);
              }
            }}
            className="h-8 w-[72px] text-sm tabular-nums text-right rounded-lg px-2"
            aria-label="Preço adicional"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingPrice(true)}
            className={cn(
              "h-8 min-w-[72px] px-2 rounded-lg text-sm tabular-nums text-right font-semibold",
              "border border-transparent hover:border-[#F6BFD2] hover:bg-[#FDF0F4] text-[#111827]",
              "transition-colors",
            )}
            title="Clique para editar o valor"
          >
            {Number(opcao.preco_adicional || 0)
              .toFixed(2)
              .replace(".", ",")}
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <Switch
          checked={disponivel}
          disabled={toggling}
          onCheckedChange={() => onToggle()}
          className="data-[state=checked]:bg-[#C8285F] data-[state=unchecked]:bg-[#D1D5DB] scale-90"
          aria-label={disponivel ? "Desativar opção" : "Ativar opção"}
        />
        <span
          className={cn(
            "text-[9px] font-semibold uppercase",
            disponivel ? "text-emerald-600" : "text-[#9CA3AF]",
          )}
        >
          {disponivel ? "On" : "Off"}
        </span>
      </div>
      <button
        type="button"
        className="text-[11px] text-red-500 opacity-100"
        onClick={onDelete}
      >
        Excluir
      </button>
    </div>
  );
}

export function ComplementosTab({
  mode = "complementos",
}: {
  mode?: "complementos" | "opcoes";
}) {
  const [grupos, setGrupos] = useState<GrupoComOpcoes[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newGrupo, setNewGrupo] = useState("");
  const [newOpcao, setNewOpcao] = useState("");
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dndReady, setDndReady] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setDndReady(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: gs }, { data: ops }] = await Promise.all([
        supabase
          .from("grupos_opcoes")
          .select("*, tag:tags(*)")
          .order("id", { ascending: true }),
        supabase
          .from("opcoes")
          .select(
            "*, grupo:grupos_opcoes(id, nome), tag:tags(*)",
          )
          .order("ordem", { ascending: true }),
      ]);

      const opcoes = (ops || []) as Opcao[];
      const mapped: GrupoComOpcoes[] = (gs || []).map((g) => ({
        ...(g as GrupoOpcoes),
        tag: (g as { tag?: TagRef | null }).tag ?? null,
        opcoes: opcoes.filter((o) => String(o.grupo_id) === String(g.id)),
      }));
      setGrupos(mapped);
      setSelectedId((cur) => cur ?? (mapped[0] ? String(mapped[0].id) : null));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("catalog-complementos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grupos_opcoes" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opcoes" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const selected = useMemo(
    () => grupos.find((g) => String(g.id) === selectedId) || null,
    [grupos, selectedId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const createGrupo = async () => {
    if (!newGrupo.trim()) return;
    setBusy(true);
    try {
      const g = await createGrupoOpcoes({
        nome: newGrupo.trim(),
        min_escolha: 0,
        max_escolha: 1,
      });
      setNewGrupo("");
      toast.success("Grupo criado");
      setSelectedId(String(g.id));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar grupo");
    } finally {
      setBusy(false);
    }
  };

  const [newOpcaoPreco, setNewOpcaoPreco] = useState("0");

  const createOption = async () => {
    if (!selected || !newOpcao.trim()) return;
    setBusy(true);
    try {
      const preco = Number(String(newOpcaoPreco).replace(",", ".")) || 0;
      await createOpcaoInGrupo({
        grupo_id: selected.id,
        nome: newOpcao.trim(),
        preco_adicional: preco < 0 ? 0 : preco,
      });
      setNewOpcao("");
      setNewOpcaoPreco("0");
      toast.success("Opção criada");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar opção");
    } finally {
      setBusy(false);
    }
  };

  const handlePriceChange = async (opcao: Opcao, preco: number) => {
    // Otimista
    setGrupos((prev) =>
      prev.map((g) => ({
        ...g,
        opcoes: g.opcoes.map((o) =>
          String(o.id) === String(opcao.id)
            ? { ...o, preco_adicional: preco }
            : o,
        ),
      })),
    );
    try {
      await updateOpcao(opcao.id, { preco_adicional: preco });
      toast.success("Preço atualizado", {
        description: `${opcao.nome}: ${formatBRL(preco)}`,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível atualizar o preço",
      );
      await load();
    }
  };

  const handleOpcaoTag = async (
    opcao: Opcao,
    tagId: string | null,
    tag: TagRow | null,
  ) => {
    setGrupos((prev) =>
      prev.map((g) => ({
        ...g,
        opcoes: g.opcoes.map((o) =>
          String(o.id) === String(opcao.id)
            ? {
                ...o,
                tag_id: tagId ? Number(tagId) : null,
                tag: tag
                  ? {
                      id: tag.id,
                      nome: tag.nome,
                      cor_fundo: tag.cor_fundo,
                      cor_texto: tag.cor_texto,
                    }
                  : null,
              }
            : o,
        ),
      })),
    );
    try {
      await updateOpcao(opcao.id, { tag_id: tagId });
      toast.success(
        tag ? `Tag “${tag.nome}” na opção` : "Tag removida da opção",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível atualizar a tag",
      );
      await load();
    }
  };

  const handleGrupoTag = async (
    grupo: GrupoComOpcoes,
    tagId: string | null,
    tag: TagRow | null,
  ) => {
    setGrupos((prev) =>
      prev.map((g) =>
        String(g.id) === String(grupo.id)
          ? {
              ...g,
              tag_id: tagId ? Number(tagId) : null,
              tag: tag
                ? {
                    id: tag.id,
                    nome: tag.nome,
                    cor_fundo: tag.cor_fundo,
                    cor_texto: tag.cor_texto,
                  }
                : null,
            }
          : g,
      ),
    );
    try {
      await updateGrupoOpcoes(grupo.id, { tag_id: tagId });
      toast.success(
        tag ? `Tag “${tag.nome}” no grupo` : "Tag removida do grupo",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível atualizar a tag",
      );
      await load();
    }
  };

  const handleOptionDrag = async (event: DragEndEvent) => {
    if (!selected) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = selected.opcoes.map((o) => `op-${o.id}`);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(selected.opcoes, oldIndex, newIndex);
    setGrupos((prev) =>
      prev.map((g) =>
        String(g.id) === String(selected.id) ? { ...g, opcoes: reordered } : g,
      ),
    );
    try {
      await Promise.all(
        reordered.map((o, i) => updateOpcao(o.id, { ordem: i + 1 })),
      );
    } catch {
      toast.error("Não foi possível reordenar");
      await load();
    }
  };

  const handleToggleOpcao = async (opcao: Opcao) => {
    const currentlyOn = isOpcaoDisponivel(opcao);
    const next = !currentlyOn;
    setTogglingId(String(opcao.id));

    // Otimista — só disponibilidade (continua no cardápio do cliente com tarja)
    setGrupos((prev) =>
      prev.map((g) => ({
        ...g,
        opcoes: g.opcoes.map((o) =>
          String(o.id) === String(opcao.id)
            ? {
                ...o,
                esta_disponivel: next,
                // Mantém status ativo para o item continuar listado no cardápio
                status: "ativo",
              }
            : o,
        ),
      })),
    );

    try {
      await updateOpcao(opcao.id, {
        esta_disponivel: next,
        // Garante que opções “esgotadas” não fiquem com status inativo
        // (inativo = removido do catálogo; esgotado = visível + indisponível)
        status: "ativo",
      });
      toast.success(
        next
          ? "Opção disponível no cardápio"
          : "Opção marcada como esgotada (continua visível para o cliente)",
      );
    } catch (e) {
      setGrupos((prev) =>
        prev.map((g) => ({
          ...g,
          opcoes: g.opcoes.map((o) =>
            String(o.id) === String(opcao.id) ? opcao : o,
          ),
        })),
      );
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar disponibilidade",
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#9CA3AF]">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Carregando grupos…
      </div>
    );
  }

  const title =
    mode === "opcoes" ? "Grupos de opções" : "Grupos de complementos";
  const subtitle =
    mode === "opcoes"
      ? "Tamanhos, tipos de leite e escolhas obrigatórias"
      : "Caldas, frutas, coberturas e adicionais";

  return (
    <div className="catalog-groups">
      <aside className="catalog-groups-nav">
        <div className="catalog-group-selector">
          <label htmlFor={`group-selector-${mode}`} className="sr-only">
            Grupo selecionado
          </label>
          <select
            id={`group-selector-${mode}`}
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {grupos.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.nome} ({g.opcoes.length})
              </option>
            ))}
          </select>
        </div>
        <div className="px-4 py-3 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{subtitle}</p>
        </div>
        <div className="p-2 flex gap-1 border-b border-[#E5E7EB]">
          <Input
            value={newGrupo}
            onChange={(e) => setNewGrupo(e.target.value)}
            aria-label="Nome do novo grupo"
            placeholder="Novo grupo…"
            className="h-9 text-sm rounded-lg"
            onKeyDown={(e) => e.key === "Enter" && void createGrupo()}
          />
          <Button
            size="icon"
            aria-label="Criar grupo"
            className="h-9 w-9 shrink-0 bg-[#C8285F] hover:bg-[#E33E70]"
            disabled={busy}
            onClick={() => void createGrupo()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {grupos.length === 0 ? (
            <CatalogEmpty kind="complementos" />
          ) : (
            grupos.map((g) => {
              const active = String(g.id) === selectedId;
              const obrigatorio = Number(g.min_escolha || 0) > 0;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(String(g.id))}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors",
                    active
                      ? "bg-[#FDF0F4] text-[#C8285F]"
                      : "hover:bg-[#F7F8FC] text-[#374151]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium truncate">{g.nome}</p>
                      {g.tag && <CatalogTagBadge tag={g.tag} />}
                    </div>
                    <p className="text-[10px] text-[#9CA3AF]">
                      {g.opcoes.length} opções ·{" "}
                      {obrigatorio ? "Obrigatório" : "Opcional"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="catalog-group-detail">
        {!selected ? (
          <CatalogEmpty kind="complementos" className="flex-1" />
        ) : (
          <>
            <div className="px-4 sm:px-6 py-4 border-b border-[#E5E7EB] bg-white flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-[#111827]">
                    {selected.nome}
                  </h3>
                  {selected.tag && (
                    <CatalogTagBadge tag={selected.tag} size="md" />
                  )}
                </div>
                <p className="text-sm text-[#6B7280]">
                  {selected.opcoes.length} opções · min{" "}
                  {selected.min_escolha ?? 0} · max {selected.max_escolha}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <TagSelectPopover
                  value={selected.tag_id}
                  tag={selected.tag}
                  onChange={(id, tag) => void handleGrupoTag(selected, id, tag)}
                  placeholder="Tag do grupo"
                  size="md"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Ações do grupo
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {" "}
                    <DropdownMenuItem
                      className="rounded-xl"
                      onClick={async () => {
                        const nome = window.prompt("Novo nome", selected.nome);
                        if (!nome?.trim()) return;
                        try {
                          await updateGrupoOpcoes(selected.id, {
                            nome: nome.trim(),
                          });
                          toast.success("Grupo atualizado");
                          await load();
                        } catch {
                          toast.error("Falha ao atualizar");
                        }
                      }}
                    >
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                      onClick={async () => {
                        if (!confirm("Excluir este grupo e suas opções?"))
                          return;
                        try {
                          await deleteGrupoOpcoes(selected.id);
                          toast.success("Grupo excluído");
                          setSelectedId(null);
                          await load();
                        } catch {
                          toast.error("Falha ao excluir");
                        }
                      }}
                    >
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="catalog-group-options space-y-3">
              <div className="flex flex-wrap gap-2 w-full items-center">
                <Input
                  value={newOpcao}
                  onChange={(e) => setNewOpcao(e.target.value)}
                  aria-label="Nome da nova opção"
                  placeholder="Nova opção (ex.: Granola)"
                  className="h-10 rounded-xl flex-1 min-w-[140px]"
                  onKeyDown={(e) => e.key === "Enter" && void createOption()}
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[#9CA3AF]">R$</span>
                  <Input
                    value={newOpcaoPreco}
                    onChange={(e) => setNewOpcaoPreco(e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="h-10 w-[88px] rounded-xl tabular-nums"
                    onKeyDown={(e) => e.key === "Enter" && void createOption()}
                    aria-label="Preço da nova opção"
                  />
                </div>
                <Button
                  className="h-10 rounded-xl bg-[#C8285F] hover:bg-[#E33E70]"
                  disabled={busy}
                  onClick={() => void createOption()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              <p className="text-[11px] text-[#9CA3AF] w-full">
                Clique no nome para renomear · clique no valor para alterar o
                preço · arraste para reordenar
              </p>

              {dndReady ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => void handleOptionDrag(e)}
                >
                  <SortableContext
                    items={selected.opcoes.map((o) => `op-${o.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5 w-full">
                      {selected.opcoes.map((o) => (
                        <OptionRow
                          key={o.id}
                          opcao={o}
                          enableDnd
                          toggling={togglingId === String(o.id)}
                          onToggle={() => void handleToggleOpcao(o)}
                          onPriceChange={(preco) =>
                            void handlePriceChange(o, preco)
                          }
                          onTagChange={(id, tag) =>
                            void handleOpcaoTag(o, id, tag)
                          }
                          onRename={async (nome) => {
                            try {
                              await updateOpcao(o.id, { nome });
                              toast.success("Opção atualizada");
                              await load();
                            } catch {
                              toast.error("Falha ao renomear");
                            }
                          }}
                          onDelete={async () => {
                            if (!confirm("Excluir opção?")) return;
                            try {
                              await deleteOpcao(o.id);
                              toast.success("Opção excluída");
                              await load();
                            } catch {
                              toast.error("Falha ao excluir");
                            }
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="space-y-1.5 w-full">
                  {selected.opcoes.map((o) => (
                    <OptionRow
                      key={o.id}
                      opcao={o}
                      toggling={togglingId === String(o.id)}
                      onToggle={() => void handleToggleOpcao(o)}
                      onPriceChange={(preco) =>
                        void handlePriceChange(o, preco)
                      }
                      onTagChange={(id, tag) => void handleOpcaoTag(o, id, tag)}
                      onRename={async (nome) => {
                        try {
                          await updateOpcao(o.id, { nome });
                          toast.success("Opção atualizada");
                          await load();
                        } catch {
                          toast.error("Falha ao renomear");
                        }
                      }}
                      onDelete={async () => {
                        if (!confirm("Excluir opção?")) return;
                        try {
                          await deleteOpcao(o.id);
                          toast.success("Opção excluída");
                          await load();
                        } catch {
                          toast.error("Falha ao excluir");
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {selected.opcoes.length === 0 && (
                <p className="text-sm text-[#9CA3AF]">
                  Nenhuma opção neste grupo ainda.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
