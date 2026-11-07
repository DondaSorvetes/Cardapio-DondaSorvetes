"use client";

import { useState } from "react";
import { Categoria } from "@/types/produto";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NovoProdutoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: Categoria[];
}

export function NovoProdutoDialog({
  open,
  onOpenChange,
  categorias,
}: NovoProdutoDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    preco_base: 0,
    categoria_id: "",
    esta_disponivel: true,
    ordem: 0,
  });

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!formData.categoria_id) {
      toast.error("Categoria é obrigatória");
      return;
    }

    if (formData.preco_base <= 0) {
      toast.error("Preço deve ser maior que zero");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          nome: formData.nome,
          descricao: formData.descricao || null,
          preco_base: formData.preco_base,
          categoria_id: formData.categoria_id,
          esta_disponivel: formData.esta_disponivel,
          ordem: formData.ordem,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Produto criado com sucesso");
      onOpenChange(false);
      
      // Resetar formulário
      setFormData({
        nome: "",
        descricao: "",
        preco_base: 0,
        categoria_id: "",
        esta_disponivel: true,
        ordem: 0,
      });
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      toast.error("Erro ao criar produto");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
            <DialogDescription>
              Preencha os dados básicos do produto. Você poderá adicionar
              imagem e mais detalhes depois.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div>
              <Label htmlFor="nome" className="text-sm">
                Nome do Produto *
              </Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                placeholder="Ex: Açaí 500ml"
                className="mt-2"
                disabled={isLoading}
                required
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="descricao" className="text-sm">
                Descrição
              </Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                placeholder="Descreva o produto..."
                rows={3}
                className="mt-2 resize-none"
                disabled={isLoading}
              />
            </div>

            {/* Preço e Categoria */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preco" className="text-sm">
                  Preço (R$) *
                </Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.preco_base}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      preco_base: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0,00"
                  className="mt-2"
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <Label htmlFor="categoria" className="text-sm">
                  Categoria *
                </Label>
                <Select
                  value={formData.categoria_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, categoria_id: value })
                  }
                  disabled={isLoading}
                  required
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione..." />
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
              <Label htmlFor="ordem" className="text-sm">
                Ordem de Exibição
              </Label>
              <Input
                id="ordem"
                type="number"
                min="0"
                value={formData.ordem}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ordem: parseInt(e.target.value) || 0,
                  })
                }
                className="mt-2"
                disabled={isLoading}
              />
            </div>

            {/* Disponível */}
            <div className="flex items-center justify-between bg-[#F8F9FC] rounded-lg p-4">
              <div>
                <Label htmlFor="disponivel" className="text-sm font-medium cursor-pointer">
                  Disponível no Cardápio
                </Label>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  O produto ficará visível para os clientes
                </p>
              </div>
              <Switch
                id="disponivel"
                checked={formData.esta_disponivel}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, esta_disponivel: checked })
                }
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#C8285F] hover:bg-[#E33E70]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Produto"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
