"use client";

import { useState, useEffect, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer, MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Pedido = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  tipo_entrega: string;
  endereco_id: string;
  endereco_completo: {
    id: string;
    cep: string;
    bairro: string;
    cidade: string;
    estado: string;
    numero: string;
    apelido: string;
    principal: boolean;
    created_at: string;
    logradouro: string;
    complemento: string;
  } | null;
  meio_pagamento: string;
  troco_para: string | null;
  subtotal: string;
  taxa_entrega: string;
  total: string;
  itens: Array<{
    qty: number;
    uid: string;
    total: number;
    produto: {
      id: string;
      name: string;
      image: string;
      price: number;
    };
    selections: Record<string, string[]>;
    observacoes: string;
  }>;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type DetalhesPedidoProps = {
  pedido: Pedido;
  onStatusChange: (pedidoId: string, novoStatus: string) => void;
  onClose: () => void;
};

const statusOpcoes = [
  { value: "pendente", label: "Pendente", cor: "#3b82f6" },
  { value: "confirmado", label: "Confirmado", cor: "#3b82f6" },
  { value: "preparando", label: "Em preparação", cor: "#f59e0b" },
  { value: "saiu_entrega", label: "Saiu p/ entrega", cor: "#8b5cf6" },
  { value: "entregue", label: "Entregue", cor: "#10b981" },
  { value: "cancelado", label: "Cancelado", cor: "#ef4444" },
];

export function DetalhesPedido({ pedido, onStatusChange, onClose }: DetalhesPedidoProps) {
  const statusAtual = statusOpcoes.find((s) => s.value === pedido.status) || statusOpcoes[0];
  type GrupoMap = {
    nome: string;
    opcoes: Record<string, string>;
  };

  const [gruposOpcoes, setGruposOpcoes] = useState<Record<string, GrupoMap>>({});

  // Buscar nomes das opções selecionadas
  useEffect(() => {
    async function buscarOpcoes() {
      const grupos: Record<string, GrupoMap> = {};

      for (const item of pedido.itens) {
        const produtoId = Number(item.produto.id);
        const { data: produto } = await supabase
          .from("produtos")
          .select("*, grupos_opcoes(*, opcoes(*))")
          .eq("id", Number.isFinite(produtoId) ? produtoId : item.produto.id as unknown as number)
          .single();

        type GrupoRow = {
          id: string | number;
          nome: string;
          opcoes?: Array<{ id: string | number; nome: string }>;
        };

        const gruposList = (
          produto as { grupos_opcoes?: GrupoRow[] } | null
        )?.grupos_opcoes;

        if (gruposList) {
          gruposList.forEach((grupo) => {
            grupos[String(grupo.id)] = {
              nome: grupo.nome,
              opcoes: (grupo.opcoes || []).reduce<Record<string, string>>(
                (acc, op) => {
                  acc[String(op.id)] = op.nome;
                  return acc;
                },
                {}
              ),
            };
          });
        }
      }

      setGruposOpcoes(grupos);
    }

    buscarOpcoes();
  }, [pedido.itens]);

  // Função para renderizar as seleções do item
  const renderSelections = (selections: Record<string, string[]>) => {
    if (!selections || Object.keys(selections).length === 0) return null;

    const items: ReactElement[] = [];

    Object.entries(selections).forEach(([grupoId, opcaoIds]) => {
      const grupo = gruposOpcoes[grupoId];
      if (!grupo || opcaoIds.length === 0) return;

      opcaoIds.forEach((opcaoId) => {
        const nomeOpcao = grupo.opcoes[opcaoId];
        if (nomeOpcao) {
          items.push(
            <span key={`${grupoId}-${opcaoId}`} className="text-sm text-gray-600">
              • {nomeOpcao}
            </span>
          );
        }
      });
    });

    return items.length > 0 ? <div className="mt-1 space-y-0.5">{items}</div> : null;
  };

  const imprimir = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const totalPedido = parseFloat(pedido.total);
    const subtotalPedido = parseFloat(pedido.subtotal);
    const taxaEntrega = parseFloat(pedido.taxa_entrega);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido #${pedido.id.slice(0, 8)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              padding: 10px;
              font-size: 12px;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .header h1 { font-size: 18px; margin-bottom: 5px; }
            .section { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
            .section-title { font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
            .item { margin-bottom: 8px; }
            .item-header { display: flex; justify-content: space-between; font-weight: bold; }
            .item-details { margin-left: 10px; font-size: 11px; color: #333; }
            .totals { margin-top: 10px; }
            .totals-line { display: flex; justify-content: space-between; margin: 3px 0; }
            .totals-line.total { font-weight: bold; font-size: 14px; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
            .footer { text-align: center; margin-top: 15px; padding-top: 10px; border-top: 2px dashed #000; font-size: 11px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PEDIDO #${pedido.id.slice(0, 8).toUpperCase()}</h1>
            <p>${format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            <p><strong>Status:</strong> ${statusAtual.label.toUpperCase()}</p>
          </div>

          <div class="section">
            <div class="section-title">Cliente</div>
            <p><strong>${pedido.cliente_nome}</strong></p>
            <p>Tel: ${pedido.cliente_telefone || 'Não informado'}</p>
          </div>

          ${pedido.tipo_entrega === 'entrega' && pedido.endereco_completo ? `
            <div class="section">
              <div class="section-title">Endereço de Entrega</div>
              <p>${pedido.endereco_completo.logradouro}, ${pedido.endereco_completo.numero}</p>
              ${pedido.endereco_completo.complemento ? `<p>${pedido.endereco_completo.complemento}</p>` : ''}
              <p>${pedido.endereco_completo.bairro}</p>
              <p>${pedido.endereco_completo.cidade} - ${pedido.endereco_completo.estado}</p>
              <p>CEP: ${pedido.endereco_completo.cep}</p>
            </div>
          ` : `
            <div class="section">
              <div class="section-title">Tipo de Entrega</div>
              <p><strong>RETIRADA NO LOCAL</strong></p>
            </div>
          `}

          <div class="section">
            <div class="section-title">Itens do Pedido</div>
            ${pedido.itens.map(item => {
              let selectionsHtml = '';
              if (item.selections && Object.keys(item.selections).length > 0) {
                const opcoes: string[] = [];
                Object.entries(item.selections).forEach(([grupoId, opcaoIds]) => {
                  const grupo = gruposOpcoes[grupoId];
                  if (grupo && Array.isArray(opcaoIds)) {
                    opcaoIds.forEach((opcaoId: string) => {
                      const nomeOpcao = grupo.opcoes[opcaoId];
                      if (nomeOpcao) {
                        opcoes.push(`  • ${nomeOpcao}`);
                      }
                    });
                  }
                });
                if (opcoes.length > 0) {
                  selectionsHtml = `<div class="item-details">${opcoes.join('<br>')}</div>`;
                }
              }
              
              return `
              <div class="item">
                <div class="item-header">
                  <span>${item.qty}x ${item.produto.name}</span>
                  <span>R$ ${item.total.toFixed(2).replace('.', ',')}</span>
                </div>
                ${selectionsHtml}
                ${item.observacoes ? `<div class="item-details">Obs: ${item.observacoes}</div>` : ''}
              </div>
            `}).join('')}
          </div>

          ${pedido.observacoes ? `
            <div class="section">
              <div class="section-title">Observações</div>
              <p>${pedido.observacoes}</p>
            </div>
          ` : ''}

          <div class="totals">
            <div class="totals-line">
              <span>Subtotal:</span>
              <span>R$ ${subtotalPedido.toFixed(2).replace('.', ',')}</span>
            </div>
            ${taxaEntrega > 0 ? `
              <div class="totals-line">
                <span>Taxa de Entrega:</span>
                <span>R$ ${taxaEntrega.toFixed(2).replace('.', ',')}</span>
              </div>
            ` : ''}
            <div class="totals-line total">
              <span>TOTAL:</span>
              <span>R$ ${totalPedido.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <div class="section" style="border: none; margin-top: 15px;">
            <div class="section-title">Pagamento</div>
            <p><strong>${pedido.meio_pagamento.toUpperCase()}</strong></p>
            ${pedido.troco_para ? `<p>Troco para: R$ ${parseFloat(pedido.troco_para).toFixed(2).replace('.', ',')}</p>` : ''}
          </div>

          <div class="footer">
            <p>Obrigado pela preferência!</p>
            <p>Volte sempre! ❤️</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const horaFormatada = format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  const subtotal = parseFloat(pedido.subtotal);
  const taxaEntrega = parseFloat(pedido.taxa_entrega);
  const total = parseFloat(pedido.total);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900 truncate">
                Pedido N° {pedido.id.slice(0, 8).toUpperCase()}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-xs lg:text-sm text-gray-500">{horaFormatada}</p>
          </div>
          <Badge
            className="px-3 py-1.5 hidden lg:flex"
            style={{ backgroundColor: statusAtual.cor + "20", color: statusAtual.cor }}
          >
            {statusAtual.label}
          </Badge>
        </div>

        {/* Badge Mobile */}
        <Badge
          className="px-3 py-1.5 mb-3 lg:hidden"
          style={{ backgroundColor: statusAtual.cor + "20", color: statusAtual.cor }}
        >
          {statusAtual.label}
        </Badge>

        {/* Ações */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={imprimir} className="flex-1 lg:flex-none">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" className="flex-1 lg:flex-none">
            <MessageSquare className="h-4 w-4 mr-2" />
            Suporte
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-3xl space-y-4 lg:space-y-6">
          {/* Tipo e Forma de Pagamento */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 lg:p-4 border border-blue-200">
              <p className="text-xs text-blue-600 mb-1 font-medium">Tipo</p>
              <p className="font-semibold text-blue-900 capitalize text-sm lg:text-base">{pedido.tipo_entrega}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 lg:p-4 border border-green-200">
              <p className="text-xs text-green-600 mb-1 font-medium">Pagamento</p>
              <p className="font-semibold text-green-900 uppercase text-sm lg:text-base">{pedido.meio_pagamento}</p>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-3 lg:p-4 border border-pink-200 col-span-2 lg:col-span-1">
              <p className="text-xs text-pink-600 mb-1 font-medium">Canal</p>
              <p className="font-semibold text-pink-900 text-sm lg:text-base">Site</p>
            </div>
          </div>

          {/* Cliente */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {pedido.cliente_nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">Cliente</h3>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 space-y-2 border border-gray-200">
              <p className="text-gray-900 font-medium">{pedido.cliente_nome}</p>
              {pedido.cliente_telefone && (
                <a
                  href={`https://wa.me/55${pedido.cliente_telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {pedido.cliente_telefone}
                </a>
              )}
            </div>
          </div>

          {/* Endereço de Entrega */}
          {pedido.tipo_entrega === "entrega" && pedido.endereco_completo && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Endereço de entrega</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-900 mb-1">
                  {pedido.endereco_completo.logradouro}, {pedido.endereco_completo.numero}
                </p>
                {pedido.endereco_completo.complemento && (
                  <p className="text-gray-600 mb-1">{pedido.endereco_completo.complemento}</p>
                )}
                <p className="text-gray-600">
                  {pedido.endereco_completo.bairro}, {pedido.endereco_completo.cidade} -{" "}
                  {pedido.endereco_completo.estado}
                </p>
                <p className="text-gray-600">CEP: {pedido.endereco_completo.cep}</p>
              </div>
            </div>
          )}

          {pedido.tipo_entrega === "retirada" && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Tipo de entrega</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-900 font-medium">🏪 Retirada no Local</p>
                <p className="text-sm text-gray-600 mt-1">Cliente irá retirar o pedido</p>
              </div>
            </div>
          )}

          {/* Itens do Pedido */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              {pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}
            </h3>
            <div className="space-y-3">
              {pedido.itens.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-gray-600">{item.qty}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.produto.name}</p>
                      
                      {/* Seleções (tamanho, complementos, etc) */}
                      {renderSelections(item.selections)}
                      
                      {/* Observações do item */}
                      {item.observacoes && (
                        <p className="text-sm text-amber-700 mt-2 bg-amber-50 p-2 rounded">
                          💬 {item.observacoes}
                        </p>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">
                      R$ {item.total.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          {pedido.observacoes && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Observação antes de finalizar o pedido
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">{pedido.observacoes}</p>
              </div>
            </div>
          )}

          {/* Totais */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
            </div>
            {taxaEntrega > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Taxa de entrega</span>
                <span>R$ {taxaEntrega.toFixed(2).replace(".", ",")}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t">
              <span>Total</span>
              <span>R$ {total.toFixed(2).replace(".", ",")}</span>
            </div>
            {pedido.troco_para && (
              <div className="flex justify-between text-sm text-gray-600 pt-2">
                <span>Troco para</span>
                <span>R$ {parseFloat(pedido.troco_para).toFixed(2).replace(".", ",")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Ações de Status */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStatusChange(pedido.id, "cancelado")}
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            Rejeitar
          </Button>
          {pedido.status === "pendente" && (
            <>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => onStatusChange(pedido.id, "confirmado")}
              >
                Confirmar
              </Button>
            </>
          )}
          {pedido.status === "confirmado" && (
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => onStatusChange(pedido.id, "preparando")}
            >
              Iniciar preparo
            </Button>
          )}
          {pedido.status === "preparando" && (
            <Button
              size="sm"
              className="bg-pink-600 hover:bg-pink-700"
              onClick={() => onStatusChange(pedido.id, "saiu_entrega")}
            >
              Saiu para entrega
            </Button>
          )}
          {pedido.status === "saiu_entrega" && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => onStatusChange(pedido.id, "entregue")}
            >
              Finalizar pedido
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
