"use server";

import { requirePageAccess } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

export type Cupom = {
  id: number;
  codigo: string;
  nome: string;
  tipo: "percentual" | "valor_fixo";
  valor: number;
  valor_minimo: number;
  limite_usos: number | null;
  usos: number;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
};

export async function listCupons() {
  await requirePageAccess("cupons");
  const { data, error } = await createServiceRoleClient()
    .from("cupons")
    .select("id, codigo, nome, tipo, valor, valor_minimo, limite_usos, usos, data_inicio, data_fim, ativo")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os cupons.");
  return (data ?? []) as Cupom[];
}

export async function createCupom(input: {
  codigo: string;
  nome: string;
  tipo: Cupom["tipo"];
  valor: number;
  valor_minimo: number;
  limite_usos: number | null;
  data_inicio: string;
  data_fim: string | null;
}) {
  await requirePageAccess("cupons");
  const codigo = input.codigo.trim().toUpperCase();
  const nome = input.nome.trim();
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isRealDate = (value: string) => {
    if (!isDate(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!/^[A-Z0-9_-]{3,32}$/.test(codigo) || !nome || nome.length > 80) throw new Error("Informe um código e nome válidos.");
  if (!Number.isFinite(input.valor) || input.valor <= 0 || (input.tipo === "percentual" && input.valor > 100)) {
    throw new Error("O valor do desconto não é válido.");
  }
  if (!Number.isFinite(input.valor_minimo) || input.valor_minimo < 0) throw new Error("O valor mínimo não é válido.");
  if (input.limite_usos != null && (!Number.isInteger(input.limite_usos) || input.limite_usos < 1)) {
    throw new Error("O limite de usos deve ser um número maior que zero.");
  }
  if (!isRealDate(input.data_inicio) || (input.data_fim && (!isRealDate(input.data_fim) || input.data_fim < input.data_inicio))) {
    throw new Error("Confira o período de validade do cupom.");
  }

  const { data, error } = await createServiceRoleClient()
    .from("cupons")
    .insert({
      codigo,
      nome,
      tipo: input.tipo,
      valor: input.valor,
      valor_minimo: input.valor_minimo,
      limite_usos: input.limite_usos,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      ativo: true,
    })
    .select("id, codigo, nome, tipo, valor, valor_minimo, limite_usos, usos, data_inicio, data_fim, ativo")
    .single();

  if (error?.code === "23505") throw new Error("Já existe um cupom com esse código.");
  if (error || !data) throw new Error("Não foi possível criar o cupom.");
  return data as Cupom;
}

export async function deleteCupom(id: number) {
  await requirePageAccess("cupons");
  const { error } = await createServiceRoleClient().from("cupons").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir o cupom.");
}
