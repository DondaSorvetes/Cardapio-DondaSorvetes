"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Categoria } from "@/types/produto";
import {
  createCategoria,
  updateCategoria,
  deleteCategoria,
} from "@/actions/admin/categorias";
import { toast } from "sonner";
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import Link from "next/link";

type CategoriaComContagem = Categoria & { produtos_count: number };

export function CategoriasManager() {
  const [categorias, setCategorias] = useState<CategoriaComContagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editOrdem, setEditOrdem] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase
          .from("categorias")
          .select("*")
          .order("ordem", { ascending: true }),
        supabase.from("produtos").select("id, categoria_id"),
      ]);

      const counts = new Map<string, number>();
      (prods || []).forEach((p) => {
        if (p.categoria_id == null) return;
        const k = String(p.categoria_id);
        counts.set(k, (counts.get(k) || 0) + 1);
      });

      setCategorias(
        (cats || []).map((c) => ({
          ...(c as Categoria),
          produtos_count: counts.get(String(c.id)) || 0,
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!novoNome.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }
    setCreating(true);
    try {
      await createCategoria({
        nome: novoNome,
        ordem: categorias.length,
      });
      setNovoNome("");
      toast.success("Categoria criada");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (c: CategoriaComContagem) => {
    setEditId(c.id);
    setEditNome(c.nome);
    setEditOrdem(c.ordem ?? 0);
  };

  const handleSaveEdit = async () => {
    if (editId == null) return;
    if (!editNome.trim()) {
      toast.error("Nome não pode ficar vazio");
      return;
    }
    setSaving(true);
    try {
      await updateCategoria(editId, { nome: editNome, ordem: editOrdem });
      toast.success("Salvo");
      setEditId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteCategoria(deleteId);
      toast.success("Categoria excluída");
      setDeleteId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-[#F7F8FC]">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        {/* Título */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">
            Categorias do cardápio
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5 leading-relaxed">
            São as seções do cardápio que o cliente vê — por exemplo{" "}
            <strong className="font-semibold text-[#374151]">Picolés</strong>,{" "}
            <strong className="font-semibold text-[#374151]">Potes</strong>{" "}
            ou{" "}
            <strong className="font-semibold text-[#374151]">Tortas Gourmet</strong>.
          </p>
        </div>

        {/* Como funciona */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FDE6EE] flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-[#C8285F]" />
          </div>
          <div className="text-sm text-[#4B5563] leading-relaxed">
            <p className="font-semibold text-[#111827] mb-1">Como usar</p>
            <ol className="list-decimal list-inside space-y-0.5 text-[#6B7280]">
              <li>Crie as categorias aqui</li>
              <li>
                Em{" "}
                <Link
                  href="/admin/produtos"
                  className="text-[#C8285F] font-medium hover:underline"
                >
                  Produtos
                </Link>
                , escolha a categoria de cada item
              </li>
            </ol>
          </div>
        </div>

        {/* Criar */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#111827] mb-3">
            Adicionar categoria
          </h2>
          <div className="flex gap-2">
            <Input
              placeholder="Ex.: Picolés, Potes, Tortas..."
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
              className="h-11 rounded-xl flex-1"
              autoFocus
            />
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || !novoNome.trim()}
              className="h-11 px-5 rounded-xl bg-[#C8285F] hover:bg-[#E33E70] shrink-0"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F3F4F6] flex items-center justify-between">
            <span className="text-sm font-bold text-[#111827]">
              Suas categorias
            </span>
            <span className="text-xs font-medium text-[#9CA3AF] tabular-nums">
              {categorias.length}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-[#C8285F] animate-spin" />
            </div>
          ) : categorias.length === 0 ? (
            <div className="text-center py-14 px-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#F3F4F6] flex items-center justify-center">
                <FolderTree className="w-7 h-7 text-[#D1D5DB]" />
              </div>
              <p className="text-sm font-medium text-[#374151]">
                Nenhuma categoria ainda
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Comece criando a primeira no campo acima
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {categorias.map((c, index) => {
                const editing = String(editId) === String(c.id);
                return (
                  <li
                    key={c.id}
                    className="px-5 py-3.5 hover:bg-[#FAFAFB] transition-colors"
                  >
                    {editing ? (
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Input
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          className="h-10 rounded-xl flex-1"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#9CA3AF] whitespace-nowrap">
                            Ordem
                          </span>
                          <Input
                            type="number"
                            value={editOrdem}
                            onChange={(e) =>
                              setEditOrdem(parseInt(e.target.value, 10) || 0)
                            }
                            className="h-10 rounded-xl w-20"
                          />
                          <Button
                            size="icon"
                            className="h-10 w-10 rounded-xl bg-[#C8285F] hover:bg-[#E33E70]"
                            disabled={saving}
                            onClick={() => void handleSaveEdit()}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-10 w-10 rounded-xl"
                            onClick={() => setEditId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-[#F3F4F6] text-[#6B7280] text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#111827] truncate">
                            {c.nome}
                          </p>
                          <p className="text-xs text-[#9CA3AF] mt-0.5">
                            {c.produtos_count === 0
                              ? "Nenhum produto nesta categoria"
                              : `${c.produtos_count} produto${c.produtos_count !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(c.id)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:bg-red-50 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {categorias.length > 0 && (
          <Link
            href="/admin/produtos"
            className="flex items-center justify-center gap-2 h-11 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#C8285F] hover:bg-[#FFF9FA] hover:border-[#F6BFD2] transition-colors"
          >
            Ir para produtos e vincular categorias
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos que estavam nela ficam sem categoria. Você pode
              escolher outra categoria depois em Produtos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
