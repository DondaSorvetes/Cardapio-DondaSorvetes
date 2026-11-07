"use client";

import { Produto } from "@/types/produto";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Package,
  Tag,
  Clock,
  Eye,
  EyeOff,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface ProdutoSidePanelProps {
  produto: Produto;
}

export function ProdutoSidePanel({ produto }: ProdutoSidePanelProps) {
  return (
    <div className="w-[280px] h-full bg-white border-l border-[#E5E7EB] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E7EB]">
        <h3 className="font-semibold text-[#111827] text-sm">Resumo</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status */}
        <section>
          <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">
            Status
          </h4>
          <div className="space-y-2">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                produto.esta_disponivel
                  ? "bg-emerald-50"
                  : "bg-red-50"
              )}
            >
              {produto.esta_disponivel ? (
                <>
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">
                    Visível no Cardápio
                  </span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">
                    Oculto no Cardápio
                  </span>
                </>
              )}
            </div>
            {!produto.imagem_url && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50">
                <Package className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  Sem Imagem
                </span>
              </div>
            )}
          </div>
        </section>

        <Separator />

        {/* Informações Rápidas */}
        <section>
          <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">
            Informações
          </h4>
          <div className="space-y-3">
            {/* ID */}
            <div className="flex items-start gap-2">
              <Tag className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">ID</p>
                <p className="text-sm font-mono text-[#111827] truncate">
                  {String(produto.id).slice(0, 8)}
                </p>
              </div>
            </div>

            {/* Categoria */}
            {produto.categoria && (
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#6B7280]">Categoria</p>
                  <p className="text-sm font-medium text-[#111827]">
                    {produto.categoria.nome}
                  </p>
                </div>
              </div>
            )}

            {/* Preço */}
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">Preço Base</p>
                <p className="text-sm font-bold text-[#C8285F]">
                  R$ {produto.preco_base.toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>

            {/* Ordem */}
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">Ordem de Exibição</p>
                <p className="text-sm font-medium text-[#111827]">
                  {produto.ordem}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Datas */}
        {(produto.created_at || produto.updated_at) && (
          <>
            <Separator />

            <section>
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">
                Histórico
              </h4>
              <div className="space-y-3">
                {/* Criado em */}
                {produto.created_at && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#6B7280]">Criado em</p>
                      <p className="text-sm text-[#111827]">
                        {format(
                          new Date(produto.created_at),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Atualizado em */}
                {produto.updated_at && produto.updated_at !== produto.created_at && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#6B7280]">Última atualização</p>
                      <p className="text-sm text-[#111827]">
                        {format(
                          new Date(produto.updated_at),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <Separator />

        {/* Estatísticas Futuras */}
        <section>
          <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">
            Estatísticas
          </h4>
          <div className="bg-[#F8F9FC] rounded-lg p-3 text-center">
            <p className="text-xs text-[#6B7280]">
              Estatísticas de vendas em breve
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
