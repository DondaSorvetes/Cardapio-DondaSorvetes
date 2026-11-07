import { parseDiasFuncionamento } from "@/types/configuracoes";

const DIAS_JS_PARA_CHAVE: Record<number, string> = {
  0: "domingo",
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
};

const DIAS_LABEL: Record<string, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

export type HorarioLojaInput = {
  horario_abertura?: string | null;
  horario_fechamento?: string | null;
  dias_funcionamento?: string | string[] | null;
  esta_aberto?: boolean;
};

export type FuncionamentoInfo = {
  dentroDoHorario: boolean;
  /** Loja marcada como aberta pelo admin E dentro do horário (se horários existirem) */
  abertaEfetiva: boolean;
  titulo: string;
  descricao: string;
  tom: "ok" | "warn" | "neutral";
};

function parseHora(value: string | null | undefined): {
  h: number;
  m: number;
} | null {
  if (!value) return null;
  const cleaned = String(value).slice(0, 5);
  const [hs, ms] = cleaned.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

function formatHora(value: string | null | undefined): string {
  const p = parseHora(value);
  if (!p) return "--:--";
  return `${String(p.h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}`;
}

function minutosDoDia(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function estaNoDiaDeFuncionamento(
  now: Date,
  dias: string[]
): boolean {
  if (dias.length === 0) return true; // sem restrição cadastrada
  const chave = DIAS_JS_PARA_CHAVE[now.getDay()];
  return dias.includes(chave);
}

function proximoDiaAberto(
  from: Date,
  dias: string[]
): { label: string; date: Date } | null {
  if (dias.length === 0) {
    const tomorrow = new Date(from);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { label: "amanhã", date: tomorrow };
  }

  for (let i = 1; i <= 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const chave = DIAS_JS_PARA_CHAVE[d.getDay()];
    if (dias.includes(chave)) {
      if (i === 1) return { label: "amanhã", date: d };
      return { label: DIAS_LABEL[chave] || chave, date: d };
    }
  }
  return null;
}

/**
 * Calcula se está dentro do horário e monta textos do painel de status.
 * Combina `esta_aberto` (flag manual) com horários cadastrados.
 */
export function calcularFuncionamento(
  input: HorarioLojaInput,
  now = new Date()
): FuncionamentoInfo {
  const abertura = parseHora(input.horario_abertura);
  const fechamento = parseHora(input.horario_fechamento);
  const dias = parseDiasFuncionamento(input.dias_funcionamento);
  const flagAberta = Boolean(input.esta_aberto);

  const abH = formatHora(input.horario_abertura);
  const feH = formatHora(input.horario_fechamento);
  const temHorario = Boolean(abertura && fechamento);

  // Sem horário cadastrado: confia só na flag
  if (!temHorario) {
    if (flagAberta) {
      return {
        dentroDoHorario: true,
        abertaEfetiva: true,
        titulo: "Dentro do horário de funcionamento",
        descricao: "Horário de funcionamento não configurado",
        tom: "ok",
      };
    }
    return {
      dentroDoHorario: false,
      abertaEfetiva: false,
      titulo: "Loja fechada",
      descricao: "A loja está marcada como fechada",
      tom: "warn",
    };
  }

  const minAb = abertura!.h * 60 + abertura!.m;
  const minFe = fechamento!.h * 60 + fechamento!.m;
  const agoraMin = minutosDoDia(now);
  const diaOk = estaNoDiaDeFuncionamento(now, dias);

  // Intervalo que cruza meia-noite (ex.: 18:00–02:00)
  const dentroRelogio =
    minFe > minAb
      ? agoraMin >= minAb && agoraMin < minFe
      : agoraMin >= minAb || agoraMin < minFe;

  const dentroDoHorario = diaOk && dentroRelogio;
  const abertaEfetiva = flagAberta && dentroDoHorario;

  if (flagAberta && dentroDoHorario) {
    return {
      dentroDoHorario: true,
      abertaEfetiva: true,
      titulo: "Dentro do horário de funcionamento",
      descricao: `Hoje das ${abH} às ${feH}`,
      tom: "ok",
    };
  }

  if (flagAberta && !dentroDoHorario) {
    const prox = proximoDiaAberto(now, dias);
    const quando = prox
      ? prox.label === "amanhã"
        ? `Abre amanhã às ${abH}`
        : `Abre ${prox.label} às ${abH}`
      : `Abre às ${abH}`;
    return {
      dentroDoHorario: false,
      abertaEfetiva: false,
      titulo: "Fora do horário de funcionamento",
      descricao: quando,
      tom: "warn",
    };
  }

  // Flag fechada manualmente
  const prox = proximoDiaAberto(now, dias);
  return {
    dentroDoHorario,
    abertaEfetiva: false,
    titulo: "Loja fechada",
    descricao: prox
      ? prox.label === "amanhã"
        ? `Abre amanhã às ${abH}`
        : `Abre ${prox.label} às ${abH}`
      : `Horário: ${abH} às ${feH}`,
    tom: "warn",
  };
}

export function formatarTempoMedio(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (min != null && max != null && min !== max) {
    const mid = Math.round((Number(min) + Number(max)) / 2);
    return `${mid} minutos`;
  }
  if (min != null) return `${Number(min)} minutos`;
  if (max != null) return `${Number(max)} minutos`;
  return "Não informado";
}
