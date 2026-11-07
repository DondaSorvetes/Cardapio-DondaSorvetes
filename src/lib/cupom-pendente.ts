/**
 * Cupom "em espera": escolhido na página /cupons com a sacola vazia, ou que ainda não
 * atingiu o pedido mínimo. A sacola tenta aplicá-lo de novo quando o subtotal muda.
 */
export const CUPOM_PENDENTE_KEY = "cupom-pendente";

export function lerCupomPendente(): string | null {
  try {
    return sessionStorage.getItem(CUPOM_PENDENTE_KEY);
  } catch {
    return null;
  }
}

export function guardarCupomPendente(codigo: string) {
  try {
    sessionStorage.setItem(CUPOM_PENDENTE_KEY, codigo);
  } catch {
    // sem storage: o cliente ainda pode digitar o código na sacola
  }
}

export function limparCupomPendente() {
  try {
    sessionStorage.removeItem(CUPOM_PENDENTE_KEY);
  } catch {
    // nada a limpar
  }
}
