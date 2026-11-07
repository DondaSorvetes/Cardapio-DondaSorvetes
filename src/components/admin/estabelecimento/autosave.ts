/**
 * Fila de salvamento automático do Estabelecimento.
 *
 * - Junta as alterações e salva depois de uma pausa (ou na hora, para switches,
 *   seleções e ao sair do campo).
 * - Um salvamento por vez, na ordem: respostas antigas nunca chegam depois das novas.
 * - Os campos nunca são bloqueados: o que for digitado durante um salvamento entra
 *   no próximo, e quem usa a fila só aplica a resposta do servidor nos campos que
 *   não têm alteração pendente (pendingKeys).
 * - Em caso de erro, as alterações voltam para a fila e são reenviadas no retry()
 *   ou na próxima edição.
 */
export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type AutosaveOptions<T extends object, R> = {
  save: (patch: Partial<T>) => Promise<R>;
  onSaved?: (patch: Partial<T>, result: R) => void;
  onStatus?: (status: AutosaveStatus, error?: unknown) => void;
  delay?: number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
};

export function createAutosave<T extends object, R>({
  save,
  onSaved,
  onStatus,
  delay = 800,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancel = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: AutosaveOptions<T, R>) {
  let pending: Partial<T> = {};
  let inflight: Partial<T> | null = null;
  let timer: unknown = null;
  let waiters: Array<() => void> = [];

  const hasPending = () => Object.keys(pending).length > 0;
  const status = (value: AutosaveStatus, error?: unknown) => onStatus?.(value, error);

  function clearTimer() {
    if (timer !== null) cancel(timer);
    timer = null;
  }

  function settle() {
    if (inflight || hasPending()) return;
    const done = waiters;
    waiters = [];
    done.forEach((resolve) => resolve());
  }

  async function run() {
    clearTimer();
    if (inflight || !hasPending()) return settle();
    const patch = pending;
    pending = {};
    inflight = patch;
    status("saving");
    try {
      const result = await save(patch);
      inflight = null;
      onSaved?.(patch, result);
      if (hasPending()) return void run();
      status("saved");
    } catch (error) {
      inflight = null;
      // O que foi editado depois tem prioridade sobre o que falhou.
      pending = { ...patch, ...pending };
      status("error", error);
    }
    settle();
  }

  return {
    /** Agenda a alteração; immediate salva já (switch, seleção, imagem). */
    queue(patch: Partial<T>, immediate = false) {
      pending = { ...pending, ...patch };
      clearTimer();
      if (inflight) return status("saving");
      status("pending");
      if (immediate) void run();
      else timer = schedule(() => void run(), delay);
    },
    /** Salva agora o que estiver na fila (ao sair do campo, trocar de seção ou sair da página). */
    flush(): Promise<void> {
      if (!inflight && !hasPending()) return Promise.resolve();
      const done = new Promise<void>((resolve) => waiters.push(resolve));
      if (!inflight) void run();
      return done;
    },
    retry() {
      if (!inflight && hasPending()) void run();
    },
    /** Campos com alteração ainda não confirmada pelo servidor. */
    pendingKeys(): Set<keyof T> {
      return new Set([...Object.keys(pending), ...Object.keys(inflight ?? {})] as Array<keyof T>);
    },
    isDirty: () => inflight !== null || hasPending(),
    dispose: clearTimer,
  };
}
