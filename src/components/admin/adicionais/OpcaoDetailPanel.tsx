"use client";

import { useState, useCallback, useEffect } from "react";
import { Opcao, GrupoOpcoes } from "@/types/adicional";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Package, Trash2, Loader2, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  updateOpcao,
  removeOpcaoDoProduto,
} from "@/actions/admin/adicionais";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OpcaoDetailPanelProps {
  opcao: Opcao;
  produtoId: string | number;
  produtoNome: string;
  grupoNome: string;
  onUpdate: (opcao: Opcao) => void;
  onDelete: () => void;
}

export function OpcaoDetailPanel({
  opcao: opcaoInicial,
  produtoId,
  produtoNome,
  grupoNome,
  onUpdate,
  onDelete,
}: OpcaoDetailPanelProps) {
  const [opcao, setOpcao] = useState(opcaoInicial);
  const [grupos, setGrupos] = useState<GrupoOpcoes[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sharedCount, setSharedCount] = useState(1);
  const supabase = createClient();

  useEffect(() => {
    setOpcao(opcaoInicial);
  }, [opcaoInicial]);

  useEffect(() => {
    const fetchGrupos = async () => {
      const { data } = await supabase
        .from("grupos_opcoes")
        .select("*")
        .order("nome");
      if (data) setGrupos(data as GrupoOpcoes[]);
    };
    void fetchGrupos();
  }, [supabase]);

  // Quantos produtos compartilham o mesmo grupo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (opcao.grupo_id == null) {
        setSharedCount(1);
        return;
      }
      const { count } = await supabase
        .from("produto_grupos")
        .select("*", { count: "exact", head: true })
        .eq("grupo_id", Number(opcao.grupo_id));
      if (!cancelled) setSharedCount(count ?? 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [opcao.grupo_id, opcao.id, supabase]);

  const handleSave = useCallback(
    async (dadosAtualizados: Partial<Opcao>) => {
      const snapshot = opcao;
      const optimistic = { ...opcao, ...dadosAtualizados } as Opcao;
      setOpcao(optimistic);
      onUpdate(optimistic);
      setIsSaving(true);

      try {
        const data = await updateOpcao(opcao.id, dadosAtualizados);
        const row = data as Opcao & { grupo?: Opcao["grupo"] };
        const opcaoAtualizada: Opcao = { ...row, grupo: row.grupo };
        setOpcao(opcaoAtualizada);
        onUpdate(opcaoAtualizada);
        toast.success("Adicional atualizado");
      } catch (error: unknown) {
        console.error("Erro completo:", error);
        setOpcao(snapshot);
        onUpdate(snapshot);
        toast.error(
          error instanceof Error ? error.message : "Erro ao atualizar adicional"
        );
      } finally {
        setIsSaving(false);
      }
    },
    [opcao, onUpdate]
  );

  const handleToggleDisponibilidade = async () => {
    if (isSaving) return;
    await handleSave({ esta_disponivel: !opcao.esta_disponivel });
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const result = await removeOpcaoDoProduto(opcao.id, produtoId);
      setShowDeleteDialog(false);
      onDelete();
      if (result.mode === "isolated") {
        toast.success("Removido só deste produto", {
          description:
            "Os outros produtos que usavam o mesmo grupo mantêm o adicional.",
        });
      } else {
        toast.success("Adicional excluído");
      }
    } catch (error: unknown) {
      console.error("Erro ao excluir opção:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir adicional"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const isShared = sharedCount > 1;

  return (
    <div className="flex-1 h-full min-w-0 bg-white flex flex-col">
      <div className="px-6 py-4 border-b border-[#E5E7EB]">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#FDE6EE] flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6 text-[#C8285F]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-[#111827] truncate">
                {opcao.nome}
              </h1>
              <p className="text-xs text-[#6B7280] mt-0.5 truncate">
                <span className="font-medium text-[#4B5563]">{produtoNome}</span>
                <span className="mx-1.5">·</span>
                {grupoNome || opcao.grupo?.nome || "Sem grupo"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-2",
                opcao.esta_disponivel
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  opcao.esta_disponivel ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              {opcao.esta_disponivel ? "Disponível" : "Esgotado"}
            </div>
            {isSaving && (
              <Loader2 className="w-4 h-4 text-[#6B7280] animate-spin" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={opcao.esta_disponivel ? "outline" : "default"}
            size="sm"
            onClick={() => void handleToggleDisponibilidade()}
            disabled={isSaving}
            className={cn(
              "h-9 rounded-xl",
              !opcao.esta_disponivel && "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {opcao.esta_disponivel
              ? "Marcar como esgotado"
              : "Marcar como disponível"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="h-9 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Remover deste produto
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl space-y-6">
          {isShared && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Este grupo de opções está em{" "}
              <strong>{sharedCount} produtos</strong>. Ao remover, o adicional
              sai <strong>somente de {produtoNome}</strong>. Os demais produtos
              continuam com o item.
            </div>
          )}

          <section className="space-y-4 rounded-2xl border border-[#E5E7EB] p-5">
            <h3 className="text-sm font-semibold text-[#111827]">
              Informações básicas
            </h3>

            <div>
              <Label
                htmlFor="nome"
                className="text-sm text-[#6B7280] mb-2 block"
              >
                Nome do adicional
              </Label>
              <Input
                id="nome"
                value={opcao.nome}
                onChange={(e) => setOpcao({ ...opcao, nome: e.target.value })}
                onBlur={() => void handleSave({ nome: opcao.nome })}
                className="h-11 rounded-xl"
                disabled={isSaving}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="preco"
                  className="text-sm text-[#6B7280] mb-2 block"
                >
                  Preço adicional (R$)
                </Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={opcao.preco_adicional}
                  onChange={(e) =>
                    setOpcao({
                      ...opcao,
                      preco_adicional: parseFloat(e.target.value) || 0,
                    })
                  }
                  onBlur={() =>
                    void handleSave({
                      preco_adicional: opcao.preco_adicional,
                    })
                  }
                  className="h-11 rounded-xl"
                  disabled={isSaving}
                />
              </div>

              <div>
                <Label
                  htmlFor="grupo"
                  className="text-sm text-[#6B7280] mb-2 block"
                >
                  Grupo de opções
                </Label>
                <Select
                  value={String(opcao.grupo_id)}
                  onValueChange={(value) => {
                    const numValue = parseInt(value, 10);
                    setOpcao({ ...opcao, grupo_id: numValue });
                    void handleSave({ grupo_id: numValue });
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {grupos.map((grupo) => (
                      <SelectItem key={grupo.id} value={String(grupo.id)}>
                        {grupo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label
                htmlFor="ordem"
                className="text-sm text-[#6B7280] mb-2 block"
              >
                Ordem de exibição
              </Label>
              <Input
                id="ordem"
                type="number"
                min="0"
                value={opcao.ordem}
                onChange={(e) =>
                  setOpcao({
                    ...opcao,
                    ordem: parseInt(e.target.value, 10) || 0,
                  })
                }
                onBlur={() => void handleSave({ ordem: opcao.ordem })}
                className="h-11 rounded-xl max-w-[200px]"
                disabled={isSaving}
              />
            </div>
          </section>
        </div>
      </ScrollArea>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover adicional deste produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {isShared ? (
                <>
                  O adicional <strong>{opcao.nome}</strong> será removido apenas
                  de <strong>{produtoNome}</strong>. Os outros{" "}
                  {sharedCount - 1} produto(s) que usam o mesmo grupo{" "}
                  <strong>não serão afetados</strong>.
                </>
              ) : (
                <>
                  O adicional <strong>{opcao.nome}</strong> será excluído de{" "}
                  <strong>{produtoNome}</strong>. Esta ação não pode ser
                  desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-[#F8F9FC] rounded-xl p-4 my-2">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center">
                <Package className="w-6 h-6 text-[#9CA3AF]" />
              </div>
              <div>
                <p className="font-semibold text-[#111827]">{opcao.nome}</p>
                <p className="text-sm text-[#6B7280]">{produtoNome}</p>
                <p className="text-sm font-bold text-[#C8285F]">
                  + R${" "}
                  {Number(opcao.preco_adicional || 0)
                    .toFixed(2)
                    .replace(".", ",")}
                </p>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover deste produto"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
