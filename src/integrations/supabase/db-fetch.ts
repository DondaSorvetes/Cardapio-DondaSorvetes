/**
 * Limite de requisições simultâneas ao banco (PostgREST) por instância serverless.
 *
 * O app não abre conexões TCP com o Postgres: o supabase-js fala HTTPS com o
 * PostgREST, que mantém o próprio pool de conexões com o banco. O que pode
 * esgotar esse pool é uma rajada de requisições (ou consultas travadas) vindas
 * de várias instâncias ao mesmo tempo. Por isso, em cada instância:
 *
 * - no máximo `maxConcurrent` requisições ao banco ficam em andamento; as
 *   demais esperam numa fila curta (`maxQueue`) por até `queueTimeoutMs`;
 * - cada requisição é abortada depois de `requestTimeoutMs`, liberando a vaga
 *   (o statement_timeout do banco, migration 0025, encerra a consulta antes);
 * - Storage, Auth e Realtime não passam pelo limite (não usam o pool do banco).
 *
 * Falhas viram rejeições do fetch, que o supabase-js devolve como `{ error }`.
 */

export type DbFetchOptions = {
  /** Requisições ao banco em andamento ao mesmo tempo, por instância. */
  maxConcurrent: number;
  /** Requisições esperando vaga; acima disso falha na hora (não acumula). */
  maxQueue: number;
  /** Tempo máximo esperando vaga na fila. */
  queueTimeoutMs: number;
  /** Tempo máximo de uma requisição ao banco (resposta completa). */
  requestTimeoutMs: number;
};

export const DB_FETCH_DEFAULTS: DbFetchOptions = {
  maxConcurrent: 10,
  maxQueue: 100,
  queueTimeoutMs: 10_000,
  requestTimeoutMs: 20_000,
};

const ENV: Record<keyof DbFetchOptions, string> = {
  maxConcurrent: "SUPABASE_DB_MAX_CONCURRENT",
  maxQueue: "SUPABASE_DB_MAX_QUEUE",
  queueTimeoutMs: "SUPABASE_DB_QUEUE_TIMEOUT_MS",
  requestTimeoutMs: "SUPABASE_DB_REQUEST_TIMEOUT_MS",
};

/** Lê os limites das variáveis de ambiente; valores inválidos usam o padrão. */
export function readDbFetchOptions(
  env: Record<string, string | undefined> = process.env,
): DbFetchOptions {
  const options = { ...DB_FETCH_DEFAULTS };
  for (const key of Object.keys(ENV) as (keyof DbFetchOptions)[]) {
    const value = Number(env[ENV[key]]);
    if (Number.isInteger(value) && value > 0) options[key] = value;
  }
  return options;
}

export class DbBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbBusyError";
  }
}

/** Só a API do banco (tabelas e RPC) usa o pool de conexões do Postgres. */
export function isDatabaseRequest(input: RequestInfo | URL): boolean {
  try {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return url.pathname.startsWith("/rest/v1/");
  } catch {
    return false;
  }
}

type Waiter = { start: () => void };

export function createDbFetch(
  base: typeof fetch,
  options: DbFetchOptions = DB_FETCH_DEFAULTS,
) {
  let active = 0;
  const queue: Waiter[] = [];

  const release = () => {
    active--;
    const next = queue.shift();
    if (next) next.start();
  };

  const acquire = () =>
    new Promise<void>((resolve, reject) => {
      if (active < options.maxConcurrent) {
        active++;
        resolve();
        return;
      }
      if (queue.length >= options.maxQueue) {
        reject(new DbBusyError("Banco ocupado: muitas requisições na fila."));
        return;
      }
      const waiter: Waiter = {
        start: () => {
          clearTimeout(timer);
          active++;
          resolve();
        },
      };
      const timer = setTimeout(() => {
        const index = queue.indexOf(waiter);
        if (index >= 0) queue.splice(index, 1);
        reject(new DbBusyError("Banco ocupado: tempo de espera na fila esgotado."));
      }, options.queueTimeoutMs);
      queue.push(waiter);
    });

  const dbFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isDatabaseRequest(input)) return base(input, init);
    await acquire();
    try {
      const timeout = AbortSignal.timeout(options.requestTimeoutMs);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      const response = await base(input, { ...init, signal });
      // A vaga só é liberada com a resposta inteira lida, como o supabase-js faz.
      const body = await response.arrayBuffer();
      return new Response([204, 205, 304].includes(response.status) ? null : body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      release();
    }
  }) as typeof fetch;

  return Object.assign(dbFetch, {
    stats: () => ({ active, queued: queue.length }),
  });
}
