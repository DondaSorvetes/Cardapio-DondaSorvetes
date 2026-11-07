/**
 * Sons de alerta de novos pedidos (painel admin).
 * Compartilhado entre realtime e a tela de configurações.
 */

import type { SomAlertaTipo } from "@/types/estabelecimento-settings";

let sharedAudioCtx: AudioContext | null = null;
let soundEnabled = true;
let soundVolume = 0.7; // 0–1
let soundType: SomAlertaTipo = "classico";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export async function ensureAudioUnlocked(): Promise<AudioContext | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }
  return ctx.state === "running" ? ctx : null;
}

export async function unlockPedidosAudio(): Promise<boolean> {
  const ctx = await ensureAudioUnlocked();
  return Boolean(ctx);
}

export function setPedidosSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (enabled) void unlockPedidosAudio();
}

export function getPedidosSoundEnabled() {
  return soundEnabled;
}

export function setPedidosSoundVolume(volume0to100: number) {
  const v = Number(volume0to100);
  soundVolume = Number.isFinite(v)
    ? Math.min(1, Math.max(0, v / 100))
    : 0.7;
}

export function getPedidosSoundVolume() {
  return Math.round(soundVolume * 100);
}

export function setPedidosSoundType(type: SomAlertaTipo) {
  soundType = type;
}

export function getPedidosSoundType() {
  return soundType;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  peak: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startAt);

  const amp = Math.max(0.0001, peak * soundVolume);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(amp, startAt + 0.02);
  gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Padrões de som por tipo */
function schedulePattern(ctx: AudioContext, type: SomAlertaTipo) {
  const t = ctx.currentTime;
  switch (type) {
    case "suave":
      playTone(ctx, 523, t, 0.16, 0.14);
      playTone(ctx, 659, t + 0.18, 0.2, 0.12);
      break;
    case "urgente":
      playTone(ctx, 880, t, 0.1, 0.28);
      playTone(ctx, 988, t + 0.12, 0.1, 0.3);
      playTone(ctx, 1175, t + 0.24, 0.12, 0.32);
      playTone(ctx, 1319, t + 0.38, 0.18, 0.28);
      break;
    case "classico":
    default:
      playTone(ctx, 880, t, 0.14, 0.25);
      playTone(ctx, 1175, t + 0.16, 0.18, 0.28);
      playTone(ctx, 1319, t + 0.36, 0.22, 0.22);
      break;
  }
}

export async function playNewOrderSound(options?: {
  force?: boolean;
  type?: SomAlertaTipo;
  volume?: number;
}) {
  if (!options?.force && !soundEnabled) return;
  try {
    if (options?.volume !== undefined) {
      setPedidosSoundVolume(options.volume);
    }
    const type = options?.type ?? soundType;
    const ctx = await ensureAudioUnlocked();
    if (!ctx) return;
    schedulePattern(ctx, type);
  } catch {
    // som opcional
  }
}

/** Aplica preferências vindas do servidor / tela de config */
export function applySoundPreferences(prefs: {
  som_alerta_ativo?: boolean;
  som_alerta_tipo?: SomAlertaTipo;
  som_alerta_volume?: number;
}) {
  if (prefs.som_alerta_ativo !== undefined) {
    setPedidosSoundEnabled(prefs.som_alerta_ativo);
  }
  if (prefs.som_alerta_tipo !== undefined) {
    setPedidosSoundType(prefs.som_alerta_tipo);
  }
  if (prefs.som_alerta_volume !== undefined) {
    setPedidosSoundVolume(prefs.som_alerta_volume);
  }
}
