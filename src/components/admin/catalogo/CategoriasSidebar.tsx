"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  MoreVertical,
  GripVertical,
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CatalogCategoria, CatalogProduto } from "./types";

const ALL_ID = "__all__";

function CategoriaItem({
  cat,
  count,
  selected,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  enableDnd = false,
}: {
  cat: CatalogCategoria;
  count: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  enableDnd?: boolean;
}) {
  if (enableDnd) {
    return (
      <CategoriaItemSortable
        cat={cat}
        count={count}
        selected={selected}
        onSelect={onSelect}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );
  }
  return (
    <CategoriaItemInner
      cat={cat}
      count={count}
      selected={selected}
      onSelect={onSelect}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    />
  );
}

function CategoriaItemSortable(
  props: Omit<Parameters<typeof CategoriaItemInner>[0], "setNodeRef" | "style" | "dragHandleProps" | "isDragging">
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(props.cat.id) });

  return (
    <CategoriaItemInner
      {...props}
      setNodeRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

function CategoriaItemInner({
  cat,
  count,
  selected,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  setNodeRef,
  style,
  isDragging,
  dragHandleProps,
}: {
  cat: CatalogCategoria;
  count: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "catalog-category-item group",
        isDragging && "is-dragging",
        selected && "is-active"
      )}
    >
      {dragHandleProps ? (
        <button
          type="button"
          className="catalog-category-drag"
          aria-label="Arrastar categoria"
          {...dragHandleProps}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      ) : (
        <span className="catalog-category-drag-spacer" aria-hidden />
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="catalog-category-select"
      >
        <span className="truncate">{cat.nome}</span>
        <span className="catalog-count">{count}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="catalog-category-menu"
            aria-label={`Menu da categoria ${cat.nome}`}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="w-3.5 h-3.5 mr-2" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CategoriasSidebar({
  categorias,
  produtos,
  selectedId,
  onSelect,
  onReorder,
  onCreate,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  categorias: CatalogCategoria[];
  produtos: CatalogProduto[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (orderedIds: string[]) => void;
  onCreate: (nome: string) => Promise<void>;
  onUpdate: (id: string | number, nome: string) => Promise<void>;
  onDuplicate: (id: string | number) => Promise<void>;
  onDelete: (id: string | number) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dndReady, setDndReady] = useState(false);
  useEffect(() => {
    setDndReady(true);
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of produtos) {
      const key =
        p.categoria_id != null ? String(p.categoria_id) : "__none__";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [produtos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = categorias.map((c) => String(c.id));
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  const submitCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(newName.trim());
      setNewName("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!editingId || !editName.trim() || busy) return;
    setBusy(true);
    try {
      await onUpdate(editingId, editName.trim());
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || busy) return;
    setBusy(true);
    try {
      await onDelete(deleteId);
      setDeleteId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="catalog-categories-panel flex w-full flex-col">
      <div className="catalog-categories-head">
        <h2>Categorias</h2>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-md text-[#9A93A3] hover:bg-[#F2ECFA] hover:text-[#C8285F]"
          onClick={() => {
            setCreating(true);
            setNewName("");
          }}
          aria-label="Nova categoria"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="catalog-categories-list">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-current={selectedId == null ? "true" : undefined}
          className={cn("catalog-category-fixed", selectedId == null && "is-active")}
        >
          <span className="truncate">Todos os produtos</span>
          <span className="catalog-count">{produtos.length}</span>
        </button>

        {creating && (
          <div className="flex gap-1 p-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Nome da categoria"
              className="h-9 text-sm rounded-lg"
            />
            <Button
              size="sm"
              className="h-9 bg-[#C8285F] hover:bg-[#A51F50]"
              disabled={busy}
              onClick={() => void submitCreate()}
            >
              OK
            </Button>
          </div>
        )}

        {(() => {
          const renderCat = (cat: CatalogCategoria, enableDnd: boolean) =>
            editingId === String(cat.id) ? (
              <div key={cat.id} className="flex gap-1 p-1">
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-9 text-sm rounded-lg"
                />
                <Button
                  size="sm"
                  className="h-9 bg-[#C8285F] hover:bg-[#A51F50]"
                  disabled={busy}
                  onClick={() => void submitEdit()}
                >
                  OK
                </Button>
              </div>
            ) : (
              <CategoriaItem
                key={cat.id}
                cat={cat}
                enableDnd={enableDnd}
                count={counts.get(String(cat.id)) || 0}
                selected={selectedId === String(cat.id)}
                onSelect={() => onSelect(String(cat.id))}
                onEdit={() => {
                  setEditingId(String(cat.id));
                  setEditName(cat.nome);
                }}
                onDuplicate={() => void onDuplicate(cat.id)}
                onDelete={() => setDeleteId(String(cat.id))}
              />
            );

          if (!dndReady) {
            return categorias.map((cat) => renderCat(cat, false));
          }

          return (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={categorias.map((c) => String(c.id))}
                strategy={verticalListSortingStrategy}
              >
                {categorias.map((cat) => renderCat(cat, true))}
              </SortableContext>
            </DndContext>
          );
        })()}

        {(counts.get("__none__") || 0) > 0 && (
          <button
            type="button"
            onClick={() => onSelect("__none__")}
            aria-current={selectedId === "__none__" ? "true" : undefined}
            className={cn("catalog-category-fixed is-muted", selectedId === "__none__" && "is-active")}
          >
            <span className="truncate">Sem categoria</span>
            <span className="catalog-count">{counts.get("__none__")}</span>
          </button>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos desta categoria ficarão sem categoria. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void confirmDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

export { ALL_ID };
