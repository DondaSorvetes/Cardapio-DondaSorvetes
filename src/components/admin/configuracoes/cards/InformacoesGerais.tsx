"use client";

import { ConfiguracaoLoja } from "@/types/configuracoes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Store } from "lucide-react";

interface InformacoesGeraisProps {
  config: ConfiguracaoLoja;
  onChange: (
    field: keyof ConfiguracaoLoja,
    value: ConfiguracaoLoja[keyof ConfiguracaoLoja]
  ) => void;
}

export function InformacoesGerais({ config, onChange }: InformacoesGeraisProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-[#FDE6EE] flex items-center justify-center">
          <Store className="w-5 h-5 text-[#C8285F]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#111827]">Informações Gerais</h3>
          <p className="text-sm text-[#6B7280]">Dados principais da loja</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Nome da Loja */}
        <div>
          <Label htmlFor="nome" className="text-sm font-medium text-[#111827] mb-2 block">
            Nome da Loja *
          </Label>
          <Input
            id="nome"
            value={config.nome}
            onChange={(e) => onChange("nome", e.target.value)}
            placeholder="Ex: Sorvetes Donda"
            className="h-11"
          />
        </div>

        {/* Descrição */}
        <div>
          <Label htmlFor="descricao" className="text-sm font-medium text-[#111827] mb-2 block">
            Descrição
          </Label>
          <Textarea
            id="descricao"
            value={config.descricao || ""}
            onChange={(e) => onChange("descricao", e.target.value)}
            placeholder="Descreva sua loja..."
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            Máximo recomendado: 150 caracteres
          </p>
        </div>

        {/* Status da Loja */}
        <div className="flex items-center justify-between bg-[#F8F9FC] rounded-xl p-4 border border-[#E5E7EB]">
          <div>
            <Label htmlFor="esta_aberto" className="text-sm font-semibold text-[#111827] cursor-pointer">
              Loja Aberta
            </Label>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {config.esta_aberto
                ? "Clientes podem fazer pedidos"
                : "Loja temporariamente fechada"}
            </p>
          </div>
          <Switch
            id="esta_aberto"
            checked={config.esta_aberto}
            onCheckedChange={(checked) => onChange("esta_aberto", checked)}
          />
        </div>

        {!config.esta_aberto && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium">
              ⚠️ Sua loja está marcada como fechada. Os clientes não poderão fazer pedidos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
