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
import { GripVertical, Plus, Loader2, MoreHorizontal } from "lucide-react";
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

/** "Obrigatório · escolha 1" / "Opcional · até 3" — em vez de min/max. */
function regraGrupo(g: GrupoOpcoes): string {
  const min = Number(g.min_escolha ?? 0);
  const max = Number(g.max_escolha ?? 1);
  if (min > 0)
    return min === max
      ? `Obrigatório · escolha ${max}`
      : `Obrigatório · escolha de ${min} a ${max}`;
  return `Opcional · até ${max}`;
}

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

  const preco = Number(opcao.preco_adicional || 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("catalog-option-row", !disponivel && "is-off")}
    >
      {dragHandleProps ? (
        <button
          type="button"
          className="catalog-option-drag"
          aria-label={`Arrastar ${opcao.nome}`}
          {...dragHandleProps}
        >
          <GripVertical className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      ) : null}

      <div className="catalog-option-name">
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
              if (e.key === "Escape") {
                setName(opcao.nome);
                setEditing(false);
              }
            }}
            aria-label="Nome da opção"
            className="h-8 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Renomear"
          >
            {opcao.nome}
          </button>
        )}
      </div>

      {/* Sem tag, o seletor só aparece ao passar o mouse (sempre no toque). */}
      <div className={cn("catalog-option-tag", !opcao.tag && "is-empty")}>
        <TagSelectPopover
          value={opcao.tag_id}
          tag={opcao.tag}
          onChange={onTagChange}
          disabled={toggling}
          placeholder=""
        />
      </div>

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
              setPriceStr(preco.toFixed(2));
              setEditingPrice(false);
            }
          }}
          className="h-8 w-[84px] shrink-0 rounded-lg px-2 text-right text-sm tabular-nums"
          aria-label="Preço adicional"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingPrice(true)}
          className={cn("catalog-option-price", preco === 0 && "is-zero")}
          title="Alterar preço"
        >
          {preco === 0 ? "Grátis" : `+ ${formatBRL(preco)}`}
        </button>
      )}

      <Switch
        checked={disponivel}
        disabled={toggling}
        onCheckedChange={() => onToggle()}
        className="h-5 w-9 shrink-0 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-[#D4D0DA] [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
        aria-label={disponivel ? `Pausar ${opcao.nome}` : `Ativar ${opcao.nome}`}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="catalog-icon-button"
            aria-label={`Mais ações de ${opcao.nome}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40"
          // Não devolve o foco ao "⋯": senão o campo de edição aberto perde o foco e fecha.
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onClick={() => setEditing(true)}>
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditingPrice(true)}>
            Alterar preço
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 focus:text-red-600"
          >
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
  const [creatingGrupo, setCreatingGrupo] = useState(false);
  const [renamingGrupo, setRenamingGrupo] = useState(false);
  const [grupoNome, setGrupoNome] = useState("");
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
      setCreatingGrupo(false);
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

  return (
    <div className="catalog-groups">
      <aside className="catalog-groups-nav">
        <div className="catalog-groups-head">
          <h2>Grupos</h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Novo grupo"
            aria-expanded={creatingGrupo}
            className="h-7 w-7 rounded-md text-[#9A93A3] hover:bg-[#F2ECFA] hover:text-[#C8285F]"
            onClick={() => {
              setCreatingGrupo((v) => !v);
              setNewGrupo("");
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        {(creatingGrupo || grupos.length === 0) && (
          <div className="catalog-groups-new">
            <Input
              autoFocus={creatingGrupo}
              value={newGrupo}
              onChange={(e) => setNewGrupo(e.target.value)}
              aria-label="Nome do novo grupo"
              placeholder={
                mode === "opcoes" ? "Ex.: Tamanho" : "Ex.: Coberturas"
              }
              className="h-9 text-sm rounded-lg"
              onKeyDown={(e) => {
                if (e.key === "Enter") void createGrupo();
                if (e.key === "Escape") setCreatingGrupo(false);
              }}
            />
            <Button
              size="sm"
              className="h-9 shrink-0 bg-[#C8285F] hover:bg-[#A51F50]"
              disabled={busy}
              onClick={() => void createGrupo()}
            >
              Criar
            </Button>
          </div>
        )}
        <div className="catalog-group-selector" role="group" aria-label="Grupo">
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              className="catalog-chip"
              aria-pressed={String(g.id) === selectedId}
              onClick={() => setSelectedId(String(g.id))}
            >
              {g.nome}
            </button>
          ))}
        </div>
        <div className="catalog-groups-list">
          {grupos.length === 0 ? (
            <CatalogEmpty kind="complementos" />
          ) : (
            grupos.map((g) => {
              const active = String(g.id) === selectedId;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(String(g.id))}
                  aria-current={active ? "true" : undefined}
                  className={cn("catalog-group-item", active && "is-active")}
                >
                  <span className="truncate">{g.nome}</span>
                  {g.tag && <CatalogTagBadge tag={g.tag} />}
                  <span className="catalog-count">{g.opcoes.length}</span>
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
            <div className="catalog-group-header">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {renamingGrupo ? (
                    <Input
                      autoFocus
                      value={grupoNome}
                      onChange={(e) => setGrupoNome(e.target.value)}
                      aria-label="Nome do grupo"
                      className="h-9 max-w-[320px] text-base font-semibold"
                      onBlur={async () => {
                        setRenamingGrupo(false);
                        const nome = grupoNome.trim();
                        if (!nome || nome === selected.nome) return;
                        try {
                          await updateGrupoOpcoes(selected.id, { nome });
                          toast.success("Grupo atualizado");
                          await load();
                        } catch {
                          toast.error("Falha ao atualizar");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") {
                          setGrupoNome(selected.nome);
                          setRenamingGrupo(false);
                        }
                      }}
                    />
                  ) : (
                    <h3>
                      <button
                        type="button"
                        title="Renomear grupo"
                        onClick={() => {
                          setGrupoNome(selected.nome);
                          setRenamingGrupo(true);
                        }}
                      >
                        {selected.nome}
                      </button>
                    </h3>
                  )}
                  <TagSelectPopover
                    value={selected.tag_id}
                    tag={selected.tag}
                    onChange={(id, tag) => void handleGrupoTag(selected, id, tag)}
                    placeholder="Tag"
                  />
                </div>
                <p className="catalog-group-rule">{regraGrupo(selected)}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="catalog-icon-button"
                    aria-label={`Ações do grupo ${selected.nome}`}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <DropdownMenuItem
                    onClick={() => {
                      setGrupoNome(selected.nome);
                      setRenamingGrupo(true);
                    }}
                  >
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={async () => {
                      if (!confirm("Excluir este grupo e suas opções?")) return;
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
                    Excluir grupo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="catalog-group-options">
              <div className="catalog-option-new">
                <Input
                  value={newOpcao}
                  onChange={(e) => setNewOpcao(e.target.value)}
                  aria-label="Nome da nova opção"
                  placeholder={
                    mode === "opcoes"
                      ? "Nova opção (ex.: 500 ml)"
                      : "Nova opção (ex.: Granola)"
                  }
                  className="h-10 rounded-lg"
                  onKeyDown={(e) => e.key === "Enter" && void createOption()}
                />
                <div className="catalog-option-new-price">
                  <span aria-hidden="true">R$</span>
                  <Input
                    value={newOpcaoPreco}
                    onChange={(e) => setNewOpcaoPreco(e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="h-10 rounded-lg pl-8 text-right tabular-nums"
                    onKeyDown={(e) => e.key === "Enter" && void createOption()}
                    aria-label="Preço da nova opção"
                  />
                </div>
                <Button
                  className="h-10 shrink-0 rounded-lg bg-[#C8285F] px-3 hover:bg-[#A51F50]"
                  disabled={busy || !newOpcao.trim()}
                  onClick={() => void createOption()}
                  aria-label="Adicionar opção"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Adicionar</span>
                </Button>
              </div>

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
                    <div className="catalog-option-list">
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
                <div className="catalog-option-list">
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
                <p className="catalog-option-empty">
                  Nenhuma opção ainda. Adicione a primeira acima.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
