/** Formas de pagamento aceitas no checkout (todas pagas na entrega/retirada). */
export const MEIOS_PAGAMENTO = [
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "pix", rotulo: "Pix" },
  { valor: "debito", rotulo: "Cartão de débito" },
  { valor: "credito", rotulo: "Cartão de crédito" },
] as const;

export type MeioPagamento = (typeof MEIOS_PAGAMENTO)[number]["valor"];

/** Aceitos pelo servidor: os atuais + "cartao" de sacolas/abas antigas. */
export const MEIOS_PAGAMENTO_ACEITOS = [
  ...MEIOS_PAGAMENTO.map((m) => m.valor),
  "cartao",
] as const;

const ROTULOS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  cartao: "Cartão",
};

/** Nome legível do meio de pagamento salvo no pedido. */
export function rotuloPagamento(valor: string | null | undefined): string {
  if (!valor) return "—";
  return ROTULOS[valor.toLowerCase()] ?? valor;
}
