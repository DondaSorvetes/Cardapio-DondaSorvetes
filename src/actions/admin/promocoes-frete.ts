"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

export type PromocaoFrete = {
  id: number;
  produto_id: number | null;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string;
  hora_fim: string;
  ativa: boolean;
  produto?: { nome: string } | null;
};

export async function listPromocoesFrete(): Promise<PromocaoFrete[]> {
  await requirePermission("catalogo:read");
  const { data, error } = await createServiceRoleClient()
    .from("promocoes_frete_gratis")
    .select("id, produto_id, data_inicio, data_fim, hora_inicio, hora_fim, ativa, produto:produtos(nome)")
    .order("data_inicio", { ascending: false });
  if (error) {
    console.error("[listPromocoesFrete] Falha ao consultar campanhas", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (/hora_inicio|hora_fim/i.test(error.message)) {
      throw new Error(
        "A tabela ainda não tem os campos de horário. Aplique a migration 0013_promocoes_frete_horario.sql no Supabase."
      );
    }
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new Error(
        "A tabela de campanhas ainda não existe. Aplique as migrations 0012 e 0013 de frete grátis no Supabase."
      );
    }
    throw new Error(`Não foi possível carregar as campanhas de frete: ${error.message}`);
  }
  return (data ?? []) as unknown as PromocaoFrete[];
}

export async function createPromocaoFrete(input: {
  produto_id: number | null;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string;
  hora_fim: string;
}) {
  await requirePermission("catalogo:write");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(input.data_fim) || input.data_fim < input.data_inicio) {
    throw new Error("Informe um período válido para a campanha.");
  }
  const isValidTime = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    return !!match && Number(match[1]) < 24 && Number(match[2]) < 60;
  };
  if (!isValidTime(input.hora_inicio) || !isValidTime(input.hora_fim)) {
    throw new Error("Informe horários válidos para a campanha.");
  }
  if (input.data_fim === input.data_inicio && input.hora_fim < input.hora_inicio) {
    throw new Error("O término deve acontecer depois do início.");
  }
  const { data, error } = await createServiceRoleClient().from("promocoes_frete_gratis").insert({
    produto_id: input.produto_id,
    data_inicio: input.data_inicio,
    data_fim: input.data_fim,
    hora_inicio: input.hora_inicio,
    hora_fim: input.hora_fim,
    ativa: true,
  }).select("id").single();
  if (error) throw new Error("Não foi possível criar a campanha de frete.");
  return data.id;
}

export async function deletePromocaoFrete(id: number) {
  await requirePermission("catalogo:write");
  const { error } = await createServiceRoleClient().from("promocoes_frete_gratis").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover a campanha.");
}
