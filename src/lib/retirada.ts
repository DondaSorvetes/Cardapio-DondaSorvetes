import { parseDiasFuncionamento } from "@/types/configuracoes";

/**
 * Retirada no estabelecimento: "agora" ou agendada em janelas de 15 minutos
 * dentro do horário de funcionamento da loja. Usado no checkout, no
 * acompanhamento do cliente e no painel de pedidos.
 */

export const JANELA_RETIRADA_MIN = 15;
/** Quantos dias à frente o cliente pode agendar (hoje incluso). */
export const DIAS_AGENDAMENTO = 7;

const DIA_CHAVE = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const DIA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export type HorarioRetirada = {
  horario_abertura?: string | null;
  horario_fechamento?: string | null;
  dias_funcionamento?: string | string[] | null;
};

export type DiaAgendamento = {
  /** yyyy-mm-dd (hora local) */
  chave: string;
  rotulo: string;
  dia: number;
  horarios: { inicio: string; rotulo: string }[];
};

function minutos(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const [h, m] = String(valor).slice(0, 5).split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

const dois = (n: number) => String(n).padStart(2, "0");
const hora = (d: Date) => `${dois(d.getHours())}h${dois(d.getMinutes())}`;

/** "10h10 - 10h25" */
export function rotuloJanela(inicio: Date): string {
  return `${hora(inicio)} - ${hora(new Date(inicio.getTime() + JANELA_RETIRADA_MIN * 60_000))}`;
}

/**
 * Dias e janelas disponíveis. A primeira janela de hoje começa depois do tempo
 * de preparo (`antecedenciaMin`) arredondado para a próxima janela de 15 min.
 */
export function gerarDiasAgendamento(
  loja: HorarioRetirada,
  antecedenciaMin: number,
  agora = new Date(),
): DiaAgendamento[] {
  const abre = minutos(loja.horario_abertura);
  const fecha = minutos(loja.horario_fechamento);
  if (abre == null || fecha == null) return [];
  const dias = parseDiasFuncionamento(loja.dias_funcionamento);
  // Expediente que passa da meia-noite (ex.: 18:00–02:00) termina no dia seguinte.
  const duracao = fecha > abre ? fecha - abre : fecha + 1440 - abre;
  const minimo = agora.getTime() + Math.max(0, antecedenciaMin) * 60_000;
  const resultado: DiaAgendamento[] = [];

  for (let i = 0; i < DIAS_AGENDAMENTO; i++) {
    const base = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
    if (dias.length && !dias.includes(DIA_CHAVE[base.getDay()])) continue;
    const horarios: DiaAgendamento["horarios"] = [];
    for (let m = abre; m + JANELA_RETIRADA_MIN <= abre + duracao; m += JANELA_RETIRADA_MIN) {
      const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, m);
      if (inicio.getTime() < minimo) continue;
      horarios.push({ inicio: inicio.toISOString(), rotulo: rotuloJanela(inicio) });
    }
    if (!horarios.length) continue;
    resultado.push({
      chave: `${base.getFullYear()}-${dois(base.getMonth() + 1)}-${dois(base.getDate())}`,
      rotulo: i === 0 ? "Hoje" : DIA_CURTO[base.getDay()],
      dia: base.getDate(),
      horarios,
    });
  }
  return resultado;
}

/** "Hoje, 10h10 - 10h25" · "Amanhã, ..." · "SEG 09/11, ..." */
export function formatarAgendamento(iso: string | null | undefined, agora = new Date()): string | null {
  if (!iso) return null;
  const inicio = new Date(iso);
  if (!Number.isFinite(inicio.getTime())) return null;
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
  const diff = Math.round((dia - hoje) / 86_400_000);
  const quando =
    diff === 0
      ? "Hoje"
      : diff === 1
        ? "Amanhã"
        : `${DIA_CURTO[inicio.getDay()]} ${dois(inicio.getDate())}/${dois(inicio.getMonth() + 1)}`;
  return `${quando}, ${rotuloJanela(inicio)}`;
}
