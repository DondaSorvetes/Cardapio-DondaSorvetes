import type { ConfiguracaoLoja } from "@/types/configuracoes";

export type FieldErrors = Partial<Record<keyof ConfiguracaoLoja, string>>;

const NUMBER_FIELDS = ["taxa_entrega", "pedido_minimo", "tempo_entrega_min", "tempo_entrega_max"] as const;

/** Regras conferidas antes de salvar: valor inválido fica só na tela, com aviso. */
export function validateConfig(c: ConfiguracaoLoja): FieldErrors {
  const errors: FieldErrors = {};
  if (!String(c.nome ?? "").trim()) errors.nome = "Informe o nome da loja.";
  for (const field of NUMBER_FIELDS) {
    const value = c[field];
    if (value != null && (!Number.isFinite(value) || value < 0)) errors[field] = "Use um número igual ou maior que zero.";
  }
  if (
    !errors.tempo_entrega_min &&
    !errors.tempo_entrega_max &&
    c.tempo_entrega_min != null &&
    c.tempo_entrega_max != null &&
    c.tempo_entrega_max < c.tempo_entrega_min
  )
    errors.tempo_entrega_max = "O tempo máximo não pode ser menor que o mínimo.";
  return errors;
}

/** "18:00:00" (banco) → "18:00" (campo de hora). */
export const hhmm = (value: string | null | undefined) => (value ?? "").slice(0, 5);
