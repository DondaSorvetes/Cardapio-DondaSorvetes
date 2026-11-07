import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { getSaoPauloDateTime } from "@/lib/promocoes/frete";

export type CupomPublico = {
  codigo: string;
  nome: string;
  tipo: "percentual" | "valor_fixo";
  valor: number;
  valor_minimo: number;
  desconto: number;
};

export type CodigoErroCupom = "INVALIDO" | "VALIDADE" | "ESGOTADO" | "MINIMO" | "INDISPONIVEL";

/** Erro de validação com motivo, para a sacola saber se vale esperar (ex.: pedido mínimo). */
export class CupomErro extends Error {
  constructor(message: string, readonly codigo: CodigoErroCupom) {
    super(message);
    this.name = "CupomErro";
  }
}

export async function validarCupom(codigoEntrada: string, subtotal: number) {
  const codigo = codigoEntrada.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(codigo) || !Number.isFinite(subtotal) || subtotal < 0) {
    throw new CupomErro("Cupom inválido.", "INVALIDO");
  }

  const { data, error } = await createServiceRoleClient()
    .from("cupons")
    .select("codigo, nome, tipo, valor, valor_minimo, limite_usos, usos, data_inicio, data_fim, ativo")
    .eq("codigo", codigo)
    .maybeSingle();

  if (error) throw new CupomErro("Não foi possível validar o cupom agora.", "INDISPONIVEL");
  if (!data || !data.ativo) throw new CupomErro("Esse cupom não é válido.", "INVALIDO");

  const hoje = getSaoPauloDateTime().date;
  if (hoje < data.data_inicio || (data.data_fim && hoje > data.data_fim)) {
    throw new CupomErro("Esse cupom está fora do período de validade.", "VALIDADE");
  }
  if (data.limite_usos != null && data.usos >= data.limite_usos) {
    throw new CupomErro("Esse cupom esgotou: já atingiu o limite de utilizações.", "ESGOTADO");
  }
  if (subtotal < Number(data.valor_minimo)) {
    throw new CupomErro(`O pedido mínimo para este cupom é R$ ${Number(data.valor_minimo).toFixed(2).replace(".", ",")}.`, "MINIMO");
  }

  const desconto = Math.min(
    subtotal,
    data.tipo === "percentual"
      ? Math.round(subtotal * Number(data.valor)) / 100
      : Number(data.valor)
  );

  return {
    codigo: data.codigo,
    nome: data.nome,
    tipo: data.tipo as CupomPublico["tipo"],
    valor: Number(data.valor),
    valor_minimo: Number(data.valor_minimo),
    desconto: Math.round(desconto * 100) / 100,
  } satisfies CupomPublico;
}

export type CupomVitrine = {
  codigo: string;
  nome: string;
  tipo: "percentual" | "valor_fixo";
  valor: number;
  valor_minimo: number;
  data_fim: string | null;
  /** Atingiu o limite de usos: continua visível, mas não pode ser aplicado. */
  esgotado: boolean;
};

/** Cupons ativos e dentro da validade para a vitrine do cliente; os que atingiram o limite vêm como esgotados. */
export async function listarCuponsDisponiveis(): Promise<CupomVitrine[]> {
  const hoje = getSaoPauloDateTime().date;
  const { data, error } = await createServiceRoleClient()
    .from("cupons")
    .select("codigo, nome, tipo, valor, valor_minimo, limite_usos, usos, data_inicio, data_fim")
    .eq("ativo", true)
    .lte("data_inicio", hoje)
    .or(`data_fim.is.null,data_fim.gte.${hoje}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error("Não foi possível carregar os cupons agora.");

  return (data ?? [])
    .map((cupom) => ({
      codigo: cupom.codigo,
      nome: cupom.nome,
      tipo: cupom.tipo as CupomVitrine["tipo"],
      valor: Number(cupom.valor),
      valor_minimo: Number(cupom.valor_minimo),
      data_fim: cupom.data_fim,
      esgotado: cupom.limite_usos != null && cupom.usos >= cupom.limite_usos,
    }))
    // Disponíveis primeiro, esgotados no fim.
    .sort((a, b) => Number(a.esgotado) - Number(b.esgotado));
}
