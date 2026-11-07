"use client";

import { useState, useCallback, useEffect } from "react";
import { Produto, Categoria } from "@/types/produto";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Package,
  Upload,
  X,
  Trash2,
  Copy,
  Eye,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { createClient } from "@/lib/supabase/client";
import { updateProduto, deleteProduto } from "@/actions/admin/produtos";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProdutoDetailPanelProps {
  produto: Produto;
  categorias: Categoria[];
  onUpdate: (produto: Produto) => void;
  onDelete: (produtoId: string | number) => void;
}

export function ProdutoDetailPanel({
  produto: produtoInicial,
  categorias,
  onUpdate,
  onDelete,
}: ProdutoDetailPanelProps) {
  const [produto, setProduto] = useState(produtoInicial);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const supabase = createClient();

  // Atualizar estado local quando produto mudar
  useEffect(() => {
    setProduto(produtoInicial);
  }, [produtoInicial]);

  const handleSave = useCallback(
    async (dadosAtualizados: Partial<Produto>) => {
      const snapshot = produto;
      const optimistic = { ...produto, ...dadosAtualizados } as Produto;
      setProduto(optimistic);
      onUpdate(optimistic);
      setIsSaving(true);

      try {
        const data = await updateProduto(produto.id, dadosAtualizados);

        const row = data as Produto & {
          categoria?: Produto["categoria"];
          tag?: Produto["tag"];
        };
        const produtoAtualizado: Produto = {
          ...row,
          categoria: row.categoria,
          tag: row.tag,
        };

        setProduto(produtoAtualizado);
        onUpdate(produtoAtualizado);
        toast.success("Produto atualizado");
      } catch (error: unknown) {
        console.error("Erro completo:", error);
        setProduto(snapshot);
        onUpdate(snapshot);
        toast.error(
          error instanceof Error ? error.message : "Erro ao atualizar produto"
        );
      } finally {
        setIsSaving(false);
      }
    },
    [produto, onUpdate]
  );

  const handleToggleDisponibilidade = async () => {
    if (isSaving) return;
    const novoStatus = !produto.esta_disponivel;
    await handleSave({ esta_disponivel: novoStatus });
  };

  // Upload de imagem
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 5MB)");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${produto.id}-${Date.now()}.${fileExt}`;
      const filePath = `Produtos/${fileName}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("DondaSorvetes")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const {
        data: { publicUrl },
      } = supabase.storage.from("DondaSorvetes").getPublicUrl(filePath);

      // Remover imagem antiga se existir
      if (produto.imagem_url) {
        const oldPath = produto.imagem_url.split("/").slice(-2).join("/");
        await supabase.storage.from("DondaSorvetes").remove([oldPath]);
      }

      // Atualizar no banco
      await handleSave({ imagem_url: publicUrl });
      setProduto({ ...produto, imagem_url: publicUrl });
      toast.success("Imagem atualizada");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!produto.imagem_url) return;

    try {
      const oldPath = produto.imagem_url.split("/").slice(-2).join("/");
      await supabase.storage.from("DondaSorvetes").remove([oldPath]);
      await handleSave({ imagem_url: undefined });
      setProduto({ ...produto, imagem_url: undefined });
      toast.success("Imagem removida");
    } catch (error) {
      console.error("Erro ao remover imagem:", error);
      toast.error("Erro ao remover imagem");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDuplicate = async () => {
    try {
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          nome: `${produto.nome} (Cópia)`,
          descricao: produto.descricao,
          preco_base: produto.preco_base,
          categoria_id: produto.categoria_id,
          esta_disponivel: false,
          ordem: produto.ordem + 1,
          imagem_url: produto.imagem_url,
          tag_id: produto.tag_id,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Produto duplicado com sucesso");
    } catch (error) {
      console.error("Erro ao duplicar produto:", error);
      toast.error("Erro ao duplicar produto");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteProduto(produto.id);
      onDelete(produto.id);
      setShowDeleteDialog(false);
      toast.success("Produto excluído com sucesso");
    } catch (error: unknown) {
      console.error("Erro ao excluir produto:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir produto"
      );
    }
  };

  return (
    <div className="flex-1 h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E7EB]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#FDE6EE] flex items-center justify-center">
              <Package className="w-6 h-6 text-[#C8285F]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111827]">
                {produto.nome}
              </h1>
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <span>ID: {String(produto.id).slice(0, 8)}</span>
                {produto.categoria && (
                  <>
                    <span>•</span>
                    <span>{produto.categoria.nome}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <div
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-2",
                produto.esta_disponivel
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  produto.esta_disponivel ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              {produto.esta_disponivel ? "Disponível" : "Esgotado"}
            </div>

            {/* Toggle Disponibilidade */}
            <Button
              variant={produto.esta_disponivel ? "outline" : "default"}
              size="sm"
              onClick={handleToggleDisponibilidade}
              disabled={isSaving}
              className={cn(
                !produto.esta_disponivel && "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {produto.esta_disponivel ? "Marcar como Esgotado" : "Marcar como Disponível"}
            </Button>

            {isSaving && (
              <span className="text-xs text-[#6B7280] flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={isSaving}
          >
            <Copy className="w-4 h-4 mr-2" />
            Duplicar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
          >
            <Eye className="w-4 h-4 mr-2" />
            Visualizar no Cardápio
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Upload de Imagem */}
          <section>
            <Label className="text-sm font-semibold text-[#111827] mb-3 block">
              Imagem do Produto
            </Label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-2xl overflow-hidden transition-all",
                dragActive
                  ? "border-[#C8285F] bg-[#FDE6EE]"
                  : "border-[#E5E7EB] bg-[#F8F9FC]"
              )}
            >
              {produto.imagem_url ? (
                <div className="relative aspect-video">
                  <Image
                    src={produto.imagem_url}
                    alt={produto.nome}
                    sizes="(max-width: 639px) calc(100vw - 48px), 492px"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => document.getElementById("image-input")?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Trocar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleRemoveImage}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center p-8 text-center">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-12 h-12 text-[#C8285F] mb-4 animate-spin" />
                      <p className="text-sm text-[#6B7280]">
                        Fazendo upload...
                      </p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-12 h-12 text-[#9CA3AF] mb-4" />
                      <p className="text-sm font-medium text-[#111827] mb-1">
                        Arraste uma imagem ou clique para selecionar
                      </p>
                      <p className="text-xs text-[#6B7280] mb-4">
                        PNG, JPG ou WEBP até 5MB
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById("image-input")?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Selecionar Arquivo
                      </Button>
                    </>
                  )}
                </div>
              )}
              <input
                id="image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageUpload(e.target.files[0]);
                  }
                }}
              />
            </div>
          </section>

          <Separator />

          {/* Informações Básicas */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-[#111827]">
              Informações Básicas
            </h3>

            {/* Nome */}
            <div>
              <Label htmlFor="nome" className="text-sm text-[#6B7280] mb-2 block">
                Nome do Produto
              </Label>
              <Input
                id="nome"
                value={produto.nome}
                onChange={(e) => {
                  setProduto({ ...produto, nome: e.target.value });
                }}
                onBlur={() => handleSave({ nome: produto.nome })}
                className="h-11"
                disabled={isSaving}
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="descricao" className="text-sm text-[#6B7280] mb-2 block">
                Descrição
              </Label>
              <Textarea
                id="descricao"
                value={produto.descricao || ""}
                onChange={(e) => {
                  setProduto({ ...produto, descricao: e.target.value });
                }}
                onBlur={() => handleSave({ descricao: produto.descricao })}
                rows={4}
                className="resize-none"
                disabled={isSaving}
              />
            </div>

            {/* Preço e Categoria */}
            <div className="grid grid-cols-2 gap-4">
              {/* Preço */}
              <div>
                <Label htmlFor="preco" className="text-sm text-[#6B7280] mb-2 block">
                  Preço Base (R$)
                </Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={produto.preco_base}
                  onChange={(e) => {
                    setProduto({
                      ...produto,
                      preco_base: parseFloat(e.target.value) || 0,
                    });
                  }}
                  onBlur={() => handleSave({ preco_base: produto.preco_base })}
                  className="h-11"
                  disabled={isSaving}
                />
              </div>

              {/* Categoria */}
              <div>
                <Label htmlFor="categoria" className="text-sm text-[#6B7280] mb-2 block">
                  Categoria
                </Label>
                <Select
                  value={String(produto.categoria_id)}
                  onValueChange={(value) => {
                    setProduto({ ...produto, categoria_id: value });
                    handleSave({ categoria_id: value });
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ordem */}
            <div>
              <Label htmlFor="ordem" className="text-sm text-[#6B7280] mb-2 block">
                Ordem de Exibição
              </Label>
              <Input
                id="ordem"
                type="number"
                min="0"
                value={produto.ordem}
                onChange={(e) => {
                  setProduto({
                    ...produto,
                    ordem: parseInt(e.target.value) || 0,
                  });
                }}
                onBlur={() => handleSave({ ordem: produto.ordem })}
                className="h-11"
                disabled={isSaving}
              />
            </div>
          </section>
        </div>
      </ScrollArea>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-[#F8F9FC] rounded-xl p-4 my-4">
            <div className="flex gap-3">
              {produto.imagem_url ? (
                <Image
                  src={produto.imagem_url}
                  alt={produto.nome}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center">
                  <Package className="w-8 h-8 text-[#9CA3AF]" />
                </div>
              )}
              <div>
                <p className="font-semibold text-[#111827]">{produto.nome}</p>
                <p className="text-sm text-[#6B7280]">
                  {produto.categoria?.nome}
                </p>
                <p className="text-sm font-bold text-[#C8285F]">
                  R$ {produto.preco_base.toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
