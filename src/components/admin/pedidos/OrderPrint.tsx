"use client";

import { rotuloPagamento } from "@/lib/pagamento";
import { Pedido, statusConfig } from "@/types/pedido";
import { formatarAgendamento } from "@/lib/retirada";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  extractComplementos,
  groupComplementos,
} from "@/lib/utils/pedido";

export type OrderPrintTipo = "cozinha" | "entrega" | "completo";

interface OrderPrintProps {
  pedido: Pedido;
  /** cozinha | entrega | completo (cozinha + entrega) */
  tipo: OrderPrintTipo;
}

function formatMoney(value: number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "RECEBIDO",
  preparando: "PREPARANDO",
  saiu_entrega: "SAIU P/ ENTREGA",
  entregue: "ENTREGUE",
  cancelado: "CANCELADO",
};

function Ticket({
  pedido,
  variant,
}: {
  pedido: Pedido;
  variant: "cozinha" | "entrega";
}) {
  const statusInfo = statusConfig[pedido.status];
  const isCozinha = variant === "cozinha";
  const isDelivery =
    pedido.tipo_entrega === "delivery" || pedido.tipo_entrega === "entrega";
  const agendamento = isDelivery ? null : formatarAgendamento(pedido.agendado_para);

  return (
    <div className="print-ticket">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div
          style={{
            fontSize: isCozinha ? 18 : 20,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Sorvetes Donda
        </div>
        {!isCozinha && (
          <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
            Sorvetes · Picolés · Delivery
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            borderTop: "2px solid #000",
            borderBottom: "2px solid #000",
            padding: "8px 0",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            {isCozinha ? "CUPOM COZINHA" : "CUPOM ENTREGA / CLIENTE"}
          </div>
          <div
            style={{
              fontSize: isCozinha ? 28 : 24,
              fontWeight: 900,
              letterSpacing: 1,
              lineHeight: 1.1,
              marginTop: 2,
            }}
          >
            #{shortId(pedido.id)}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {format(new Date(pedido.created_at), "dd/MM/yyyy  HH:mm", {
              locale: ptBR,
            })}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.45 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
          }}
        >
          <span>{isDelivery ? "ENTREGA" : agendamento ? "RETIRADA AGENDADA" : "RETIRAR AGORA"}</span>
          <span>
            {!isDelivery && pedido.status === "saiu_entrega"
              ? "PRONTO P/ RETIRADA"
              : !isDelivery && pedido.status === "entregue"
                ? "RETIRADO"
                : STATUS_LABEL[pedido.status] || statusInfo.label}
          </span>
        </div>
        {agendamento && (
          <div style={{ marginTop: 4, padding: "4px 0", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", fontWeight: 900, fontSize: 13 }}>
            RETIRADA: {agendamento.toUpperCase()}
          </div>
        )}

        <div style={{ marginTop: 6, fontWeight: isCozinha ? 700 : 400 }}>
          <div>
            <strong>Cliente:</strong> {pedido.cliente_nome}
          </div>
          {pedido.cliente_telefone && (
            <div>
              <strong>Tel:</strong> {pedido.cliente_telefone}
            </div>
          )}
        </div>
      </div>

      {isDelivery && pedido.endereco_completo && (
        <div
          style={{
            marginBottom: 10,
            padding: "6px 0",
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 2 }}>ENDEREÇO</div>
          <div>{pedido.endereco_completo}</div>
        </div>
      )}

      {/* Itens */}
      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 1,
          padding: "6px 0",
          borderTop: "2px solid #000",
          borderBottom: "2px solid #000",
          marginBottom: 8,
        }}
      >
        ITENS DO PEDIDO
      </div>

      <div style={{ marginBottom: 8 }}>
        {pedido.itens.map((item, index) => {
          const complementos = extractComplementos(item);
          const grupos = groupComplementos(complementos);

          return (
            <div
              key={item.uid || index}
              style={{
                marginBottom: 10,
                paddingBottom: 8,
                borderBottom:
                  index < pedido.itens.length - 1 ? "1px dashed #666" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: isCozinha ? 14 : 13,
                    fontWeight: 900,
                    lineHeight: 1.25,
                    flex: 1,
                  }}
                >
                  {item.qty}x {item.produto.name}
                </div>
                {!isCozinha && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    R$ {formatMoney(item.total)}
                  </div>
                )}
              </div>

              {!isCozinha && (
                <div style={{ fontSize: 10, marginLeft: 2, opacity: 0.75 }}>
                  un. R$ {formatMoney(item.produto.price)}
                </div>
              )}

              {grupos.length > 0 && (
                <div style={{ marginTop: 4, marginLeft: 4 }}>
                  {grupos.map((grupo, gIdx) => (
                    <div key={gIdx} style={{ marginBottom: 3 }}>
                      <div
                        style={{
                          fontSize: isCozinha ? 11 : 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          marginBottom: 1,
                        }}
                      >
                        {grupo.groupName}
                      </div>
                      {grupo.items.map((comp, cIdx) => (
                        <div
                          key={cIdx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: isCozinha ? 12 : 11,
                            lineHeight: 1.3,
                            paddingLeft: 6,
                          }}
                        >
                          <span>+ {comp.name}</span>
                          {!isCozinha && comp.price > 0 && (
                            <span
                              style={{ whiteSpace: "nowrap", marginLeft: 6 }}
                            >
                              +R$ {formatMoney(comp.price)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {typeof item.colher === "boolean" && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: isCozinha ? 13 : 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  {item.colher ? "COM COLHER" : "SEM COLHER"}
                </div>
              )}

              {item.observacoes && (
                <div
                  style={{
                    marginTop: 4,
                    padding: "4px 6px",
                    border: "1px solid #000",
                    fontSize: isCozinha ? 12 : 11,
                    fontWeight: isCozinha ? 700 : 500,
                  }}
                >
                  OBS: {item.observacoes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pedido.observacoes && (
        <div
          style={{
            marginBottom: 10,
            padding: 8,
            border: "2px solid #000",
            fontSize: 12,
          }}
        >
          <div
            style={{ fontWeight: 900, marginBottom: 4, textAlign: "center" }}
          >
            OBSERVAÇÕES DO PEDIDO
          </div>
          <div style={{ lineHeight: 1.35 }}>{pedido.observacoes}</div>
        </div>
      )}

      {!isCozinha && (
        <>
          <div
            style={{
              borderTop: "2px solid #000",
              paddingTop: 8,
              marginBottom: 8,
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 2,
              }}
            >
              <span>Subtotal</span>
              <span>R$ {formatMoney(pedido.subtotal)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span>Taxa de entrega</span>
              <span>R$ {formatMoney(pedido.taxa_entrega)}</span>
            </div>
            {pedido.cupom_codigo && <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 6 }}><span>Cupom {pedido.cupom_codigo}</span><span>− R$ {formatMoney(Number(pedido.desconto_cupom || 0))}</span></div>}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 16,
                fontWeight: 900,
                borderTop: "1px solid #000",
                paddingTop: 6,
              }}
            >
              <span>TOTAL</span>
              <span>R$ {formatMoney(pedido.total)}</span>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px dashed #000",
              borderBottom: "1px dashed #000",
              padding: "8px 0",
              marginBottom: 10,
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 2 }}>PAGAMENTO</div>
            <div style={{ textTransform: "uppercase" }}>
              {rotuloPagamento(pedido.meio_pagamento)}
            </div>
            {pedido.troco_para != null && Number(pedido.troco_para) > 0 && (
              <div style={{ marginTop: 2 }}>
                Troco para: R$ {formatMoney(Number(pedido.troco_para))}
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 6 }}>
        {isCozinha ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>
              BOM TRABALHO!
            </div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
              Donda · Cozinha
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 900 }}>
              Obrigado pela preferência!
            </div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
              Sorvetes Donda Delivery
            </div>
          </>
        )}
        <div
          style={{
            marginTop: 8,
            borderTop: "1px dashed #000",
            paddingTop: 6,
            fontSize: 9,
            letterSpacing: 0.5,
          }}
        >
          *** FIM DO CUPOM ***
        </div>
      </div>
    </div>
  );
}

export function OrderPrint({ pedido, tipo }: OrderPrintProps) {
  const tickets: Array<"cozinha" | "entrega"> =
    tipo === "completo"
      ? ["cozinha", "entrega"]
      : tipo === "cozinha"
        ? ["cozinha"]
        : ["entrega"];

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          .print-root,
          .print-root * {
            visibility: visible !important;
          }
          .print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #000 !important;
            font-family: "Courier New", Courier, monospace !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 99999 !important;
          }
          .print-ticket {
            width: 80mm !important;
            box-sizing: border-box !important;
            padding: 4mm 5mm 8mm !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .print-ticket:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      <div className="print-root hidden print:block" aria-hidden>
        {tickets.map((variant) => (
          <Ticket key={variant} pedido={pedido} variant={variant} />
        ))}
      </div>
    </>
  );
}
