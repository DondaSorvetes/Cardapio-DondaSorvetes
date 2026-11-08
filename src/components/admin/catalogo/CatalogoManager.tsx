"use client";
import "./catalog.css";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Settings2, X } from "lucide-react";
import {
  createProduto,
  updateProduto,
  deleteProduto,
  duplicateProduto,
  reorderProdutos,
} from "@/actions/admin/produtos";
import {
  createCategoria,
  updateCategoria,
  deleteCategoria,
  duplicateCategoria,
  reorderCategorias,
} from "@/actions/admin/categorias";
import { setProdutoGrupos } from "@/actions/admin/grupos-opcoes";
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
import { CatalogoHeader } from "./CatalogoHeader";
import { CatalogoTabs } from "./CatalogoTabs";
import { CategoriasSidebar } from "./CategoriasSidebar";
import { ProdutosArea } from "./ProdutosArea";
import { ProdutoDrawer, type ProdutoFormValues } from "./ProdutoDrawer";
import { ComplementosTab } from "./ComplementosTab";
import { CombosTab } from "./CombosTab";
import { PromocoesFreteTab } from "./PromocoesFreteTab";
import type { PromocaoFrete } from "@/actions/admin/promocoes-frete";
import type { ComboAdmin } from "@/actions/admin/combos";
import type { CatalogTab, CatalogProduto, CatalogCategoria } from "./types";

interface CatalogoManagerProps {
  loadError?: boolean;
  produtosIniciais: CatalogProduto[];
  categoriasIniciais: CatalogCategoria[];
  promocoesFreteIniciais: PromocaoFrete[];
  promocoesFreteErro: string | null;
  combosIniciais: ComboAdmin[];
  combosErro: string | null;
}

export function CatalogoManager({
  loadError = false,
  produtosIniciais,
  categoriasIniciais,
  promocoesFreteIniciais,
  promocoesFreteErro,
  combosIniciais,
  combosErro,
}: CatalogoManagerProps) {
  const [manageCategories, setManageCategories] = useState(false);
  const [tab, setTab] = useState<CatalogTab>("produtos");
  const [produtos, setProdutos] = useState<CatalogProduto[]>(produtosIniciais);
  const [categorias, setCategorias] =
    useState<CatalogCategoria[]>(categoriasIniciais);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProduto, setDrawerProduto] = useState<CatalogProduto | null>(
    null,
  );
  const [drawerReadOnly, setDrawerReadOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduto | null>(null);
  const [comboCreateOpen, setComboCreateOpen] = useState(false);
  const [campanhaCreateOpen, setCampanhaCreateOpen] = useState(false);

  const supabase = createClient();

  // Realtime produtos + categorias
  useEffect(() => {
    const channel = supabase
      .channel("catalogo-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "produtos" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: number };
            if (old?.id != null) {
              setProdutos((prev) =>
                prev.filter((p) => String(p.id) !== String(old.id)),
              );
            }
            return;
          }

          const row = payload.new as { id?: number };
          if (row?.id == null) return;

          const { data } = await supabase
            .from("produtos")
            .select(
              `*, categoria:categorias(id, nome), tag:tags(*)`,
            )
            .eq("id", row.id)
            .maybeSingle();

          if (!data) return;
          const full = data as CatalogProduto;

          setProdutos((prev) => {
            const idx = prev.findIndex((p) => String(p.id) === String(full.id));
            if (idx === -1) return [full, ...prev];
            const copy = prev.slice();
            copy[idx] = full;
            return copy;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categorias" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: number };
            if (old?.id != null) {
              setCategorias((prev) =>
                prev.filter((c) => String(c.id) !== String(old.id)),
              );
              setSelectedCategoriaId((cur) =>
                cur === String(old.id) ? null : cur,
              );
            }
            return;
          }
          const row = payload.new as CatalogCategoria;
          if (!row?.id) return;
          setCategorias((prev) => {
            const idx = prev.findIndex((c) => String(c.id) === String(row.id));
            if (idx === -1) {
              return [...prev, row].sort(
                (a, b) => Number(a.ordem || 0) - Number(b.ordem || 0),
              );
            }
            const copy = prev.slice();
            copy[idx] = { ...copy[idx], ...row };
            return copy.sort(
              (a, b) => Number(a.ordem || 0) - Number(b.ordem || 0),
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const openNovo = useCallback(() => {
    setDrawerProduto(null);
    setDrawerReadOnly(false);
    setDrawerOpen(true);
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.key === "n" || e.key === "N") && tab === "produtos") {
        e.preventDefault();
        openNovo();
      }
      if (e.key === "/") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>(
          'input[aria-label="Buscar produtos"]',
        );
        el?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNovo, tab]);

  const openEdit = (p: CatalogProduto) => {
    setDrawerProduto(p);
    setDrawerReadOnly(false);
    setDrawerOpen(true);
  };

  const openView = (p: CatalogProduto) => {
    setDrawerProduto(p);
    setDrawerReadOnly(true);
    setDrawerOpen(true);
  };

  const handleSave = async (values: ProdutoFormValues) => {
    try {
      let produtoId: string | number;

      if (drawerProduto?.id != null) {
        const promoRaw = values.preco_promocional;
        const precoPromocional =
          promoRaw === "" || promoRaw == null
            ? null
            : Number(promoRaw) > 0
              ? Number(promoRaw)
              : null;

        const updated = await updateProduto(drawerProduto.id, {
          nome: values.nome,
          descricao: values.descricao || null,
          preco_base: values.preco_base,
          preco_promocional: precoPromocional,
          categoria_id: values.categoria_id || null,
          esta_disponivel: values.esta_disponivel,
          pergunta_colher: values.pergunta_colher,
          imagem_url: values.imagem_url || null,
          tag_id: values.tagId,
        });
        produtoId = updated.id ?? drawerProduto.id;
        toast.success("Produto atualizado");
      } else {
        const promoRaw = values.preco_promocional;
        const precoPromocional =
          promoRaw === "" || promoRaw == null
            ? null
            : Number(promoRaw) > 0
              ? Number(promoRaw)
              : null;

        const created = await createProduto({
          nome: values.nome,
          descricao: values.descricao || null,
          preco_base: values.preco_base,
          preco_promocional: precoPromocional,
          categoria_id: values.categoria_id || null,
          esta_disponivel: values.esta_disponivel,
          pergunta_colher: values.pergunta_colher,
          imagem_url: values.imagem_url || null,
          tag_id: values.tagId,
        });
        produtoId = created.id;
        toast.success("Produto criado");
      }

      // Só sincroniza produto_grupos quando a lista foi hidratada no drawer.
      // syncGrupos === false evita apagar complementos ao salvar só tag/preço.
      if (values.syncGrupos !== false) {
        try {
          await setProdutoGrupos(produtoId, values.grupoIds || []);
        } catch (linkErr) {
          console.error(linkErr);
          toast.error("Produto salvo, mas falhou ao vincular complementos", {
            description:
              linkErr instanceof Error
                ? linkErr.message
                : "Tente editar de novo",
          });
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar produto");
      throw e;
    }
  };

  const handleDuplicate = async (p: CatalogProduto) => {
    try {
      await duplicateProduto(p.id);
      toast.success("Produto duplicado (inativo)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao duplicar");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduto(deleteTarget.id);
      toast.success("Produto excluído");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const handleToggle = async (p: CatalogProduto) => {
    // null/undefined no banco = ativo. Só false é inativo.
    const currentlyOn = p.esta_disponivel !== false;
    const next = !currentlyOn;

    // Otimista — UI responde na hora
    setProdutos((prev) =>
      prev.map((item) =>
        String(item.id) === String(p.id)
          ? { ...item, esta_disponivel: next }
          : item,
      ),
    );

    try {
      const updated = await updateProduto(p.id, {
        esta_disponivel: next,
      });
      setProdutos((prev) =>
        prev.map((item) =>
          String(item.id) === String(p.id)
            ? ({ ...item, ...updated } as CatalogProduto)
            : item,
        ),
      );
      toast.success(next ? "Produto ativado" : "Produto desativado");
    } catch (e) {
      // rollback
      setProdutos((prev) =>
        prev.map((item) =>
          String(item.id) === String(p.id)
            ? { ...item, esta_disponivel: p.esta_disponivel }
            : item,
        ),
      );
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar disponibilidade",
      );
    }
  };

  const handleReorderProdutos = async (orderedIds: string[]) => {
    // optimistic
    setProdutos((prev) => {
      const map = new Map(prev.map((p) => [String(p.id), p]));
      const reordered = orderedIds
        .map((id, i) => {
          const p = map.get(id);
          if (!p) return null;
          return { ...p, ordem: i + 1 };
        })
        .filter(Boolean) as CatalogProduto[];
      const rest = prev.filter((p) => !orderedIds.includes(String(p.id)));
      return [...reordered, ...rest];
    });
    try {
      await reorderProdutos(orderedIds);
    } catch {
      toast.error("Falha ao reordenar produtos");
    }
  };

  const handleReorderCategorias = async (orderedIds: string[]) => {
    setCategorias((prev) => {
      const map = new Map(prev.map((c) => [String(c.id), c]));
      return orderedIds
        .map((id, i) => {
          const c = map.get(id);
          if (!c) return null;
          return { ...c, ordem: i + 1 };
        })
        .filter(Boolean) as CatalogCategoria[];
    });
    try {
      await reorderCategorias(orderedIds);
    } catch {
      toast.error("Falha ao reordenar categorias");
    }
  };

  const exportCatalog = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      categorias,
      produtos,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `donda-catalogo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Catálogo exportado");
  };

  return (
    <div className="catalog-page">
      <CatalogoHeader
        activeTab={tab}
        onPrimary={() =>
          tab === "combos"
            ? setComboCreateOpen(true)
            : tab === "promocoes"
              ? setCampanhaCreateOpen(true)
              : openNovo()
        }
        onImport={() =>
          toast.message("Importação em breve", {
            description: "Em breve você poderá importar planilhas CSV/JSON.",
          })
        }
        onExport={exportCatalog}
      />

      <CatalogoTabs active={tab} onChange={setTab} />
      {loadError && tab === "produtos" && <div role="alert" className="my-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Não foi possível carregar o catálogo. <button type="button" className="underline" onClick={() => window.location.reload()}>Tentar novamente</button></div>}

      {tab === "produtos" && (
        <div className="catalog-body">
          <div className="catalog-mobile-categories">
            <div className="catalog-chip-row" role="group" aria-label="Categoria">
              {[
                { id: null as string | null, nome: "Todos" },
                ...categorias.map((c) => ({ id: String(c.id), nome: c.nome })),
                ...(produtos.some((p) => p.categoria_id == null) ||
                selectedCategoriaId === "__none__"
                  ? [{ id: "__none__", nome: "Sem categoria" }]
                  : []),
              ].map((c) => (
                <button
                  key={c.id ?? "__all__"}
                  type="button"
                  aria-pressed={selectedCategoriaId === c.id}
                  className="catalog-chip"
                  onClick={() => setSelectedCategoriaId(c.id)}
                >
                  {c.nome}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="catalog-chip-manage"
              aria-expanded={manageCategories}
              aria-label={manageCategories ? "Fechar categorias" : "Gerenciar categorias"}
              onClick={() => setManageCategories((v) => !v)}
            >
              {manageCategories ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <Settings2 size={18} aria-hidden="true" />
              )}
            </button>
          </div>
          <div
            className={
              manageCategories
                ? "catalog-categories is-open"
                : "catalog-categories"
            }
          >
            <CategoriasSidebar
              categorias={categorias}
              produtos={produtos}
              selectedId={selectedCategoriaId}
              onSelect={setSelectedCategoriaId}
              onReorder={(ids) => void handleReorderCategorias(ids)}
              onCreate={async (nome) => {
                await createCategoria({ nome });
                toast.success("Categoria criada");
              }}
              onUpdate={async (id, nome) => {
                await updateCategoria(id, { nome });
                toast.success("Categoria atualizada");
              }}
              onDuplicate={async (id) => {
                await duplicateCategoria(id);
                toast.success("Categoria duplicada");
              }}
              onDelete={async (id) => {
                await deleteCategoria(id);
                toast.success("Categoria excluída");
              }}
            />
          </div>

          <ProdutosArea
            categorias={categorias}
            produtos={produtos}
            selectedCategoriaId={selectedCategoriaId}
            search={search}
            onSearchChange={setSearch}
            onReorder={(ids) => void handleReorderProdutos(ids)}
            onEdit={openEdit}
            onDuplicate={(p) => void handleDuplicate(p)}
            onView={openView}
            onDelete={setDeleteTarget}
            onToggleDisponivel={(p) => void handleToggle(p)}
            onNovoProduto={openNovo}
          />
        </div>
      )}

      {tab === "complementos" && <ComplementosTab mode="complementos" />}
      {tab === "opcoes" && <ComplementosTab mode="opcoes" />}
      {tab === "combos" && (
        <CombosTab
          products={produtos}
          initial={combosIniciais}
          loadError={combosErro}
          createOpen={comboCreateOpen}
          onCreateOpenChange={setComboCreateOpen}
        />
      )}
      {tab === "promocoes" && (
        <PromocoesFreteTab
          products={produtos}
          initial={promocoesFreteIniciais}
          loadError={promocoesFreteErro}
          createOpen={campanhaCreateOpen}
          onCreateOpenChange={setCampanhaCreateOpen}
        />
      )}

      <ProdutoDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        produto={drawerProduto}
        categorias={categorias}
        defaultCategoriaId={selectedCategoriaId}
        onSave={handleSave}
        readOnly={drawerReadOnly}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.nome}” será removido do catálogo. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
