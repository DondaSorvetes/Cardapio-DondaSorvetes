"use client";

import { useState, useEffect } from "react";
import { Opcao, GrupoOpcoes } from "@/types/adicional";
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
import { Label } from "@/components/ui/label";
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

interface NovoOpcaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (opcao: Opcao) => void;
}

export function NovoOpcaoDialog({
  open,
  onOpenChange,
  onCreate,
}: NovoOpcaoDialogProps) {
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState(0);
  const [grupoId, setGrupoId] = useState<string>("");
  const [grupos, setGrupos] = useState<GrupoOpcoes[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  // Buscar grupos
  useEffect(() => {
    const fetchGrupos = async () => {
      const { data } = await supabase
        .from("grupos_opcoes")
        .select("*")
        .order("nome");
      if (data) {
        setGrupos(data);
        if (data.length > 0) {
          setGrupoId(String(data[0].id));
        }
      }
    };
    if (open) {
      fetchGrupos();
    }
  }, [open, supabase]);

  const handleCreate = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!grupoId) {
      toast.error("Selecione um grupo");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("opcoes")
        .insert({
          nome: nome.trim(),
          preco_adicional: preco,
          grupo_id: parseInt(grupoId),
          status: "ativo",
          esta_disponivel: true,
          ordem: 0,
        })
        .select(`
          *,
          grupo:grupos_opcoes(id, nome)
        `)
        .single();

      if (error) throw error;

      const novaOpcao = {
        ...data,
        grupo: (data as { grupo?: Opcao["grupo"] }).grupo,
      } as Opcao;

      onCreate(novaOpcao);
      toast.success("Adicional criado com sucesso");
      
      // Limpar form
      setNome("");
      setPreco(0);
      setGrupoId(grupos.length > 0 ? String(grupos[0].id) : "");
    } catch (error) {
      console.error("Erro ao criar opção:", error);
      toast.error("Erro ao criar adicional");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Adicional</DialogTitle>
          <DialogDescription>
            Crie um novo adicional para seus produtos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nome */}
          <div>
            <Label htmlFor="nome" className="text-sm text-[#6B7280] mb-2 block">
              Nome do Adicional *
            </Label>
            <Input
              id="nome"
              placeholder="Ex: Chocolate, Morango, etc."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-11"
              disabled={isLoading}
            />
          </div>

          {/* Preço */}
          <div>
            <Label htmlFor="preco" className="text-sm text-[#6B7280] mb-2 block">
              Preço Adicional (R$)
            </Label>
            <Input
              id="preco"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={preco}
              onChange={(e) => setPreco(parseFloat(e.target.value) || 0)}
              className="h-11"
              disabled={isLoading}
            />
          </div>

          {/* Grupo */}
          <div>
            <Label htmlFor="grupo" className="text-sm text-[#6B7280] mb-2 block">
              Grupo de Opções *
            </Label>
            <Select
              value={grupoId}
              onValueChange={setGrupoId}
              disabled={isLoading || grupos.length === 0}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {grupos.map((grupo) => (
                  <SelectItem key={grupo.id} value={String(grupo.id)}>
                    {grupo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {grupos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhum grupo disponível. Crie um grupo primeiro.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading || !nome.trim() || !grupoId}
            className="bg-[#C8285F] hover:bg-[#E33E70]"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Adicional
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
