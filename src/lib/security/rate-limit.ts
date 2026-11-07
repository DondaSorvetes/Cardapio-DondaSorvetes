/**
 * Rate limiting por IP + bucket.
 *
 * - Padrão: Map em memória via globalThis (persiste no processo / isolate)
 * - Produção multi-instância: defina UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *
 * ⚠️ Map in-memory NÃO compartilha contadores entre:
 *   - Edge Middleware e Route Handlers (runtimes distintos)
 *   - Isolates serverless (Vercel cold starts / multi-região)
 * Por isso o middleware e o withApiGuard usam buckets distintos e, em produção,
 * Redis é a fonte da verdade.
 */

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
};

type Bucket = {
  count: number;
  resetAt: number;
};

/** Store no globalThis — evita reset em HMR / reimport do módulo no mesmo processo */
const globalForRl = globalThis as typeof globalThis & {
  __dondaRateLimitStore?: Map<string, Bucket>;
};

function getStore(): Map<string, Bucket> {
  if (!globalForRl.__dondaRateLimitStore) {
    globalForRl.__dondaRateLimitStore = new Map();
  }
  return globalForRl.__dondaRateLimitStore;
}

/** Limpa buckets expirados periodicamente (evita leak em long-running) */
function gc(now: number) {
  const store = getStore();
  if (store.size < 5000) return;
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k);
  }
}

export type RateLimitConfig = {
  /** Identificador lógico: "auth:login", "api:pedidos" */
  bucket: string;
  /** Máximo de requests na janela */
  limit: number;
  /** Janela em segundos */
  windowSec: number;
};

/**
 * Presets por tipo de rota (OWASP: throttling por endpoint).
 */
export const RATE_LIMITS = {
  login: { bucket: "auth:login", limit: 5, windowSec: 60 },
  register: { bucket: "auth:register", limit: 3, windowSec: 60 },
  api: { bucket: "api:general", limit: 120, windowSec: 60 },
  eventos: { bucket: "api:order-events:ip", limit: 30, windowSec: 60 },
  eventosUsuario: { bucket: "api:order-events:owner", limit: 30, windowSec: 60 },
  apiStrict: { bucket: "api:strict", limit: 30, windowSec: 60 },
  checkout: { bucket: "api:checkout", limit: 10, windowSec: 60 },
  /** Leituras públicas e cacheadas do cardápio/loja (opções do produto, loja, contagens).
   *  Separado de apiStrict para a navegação normal não esgotar a cota e travar "adicionar à sacola". */
  catalogo: { bucket: "api:catalog", limit: 120, windowSec: 60 },
  /** Validação de cupom: própria cota, para não consumir a de criar pedido (checkout). */
  cupom: { bucket: "api:coupon", limit: 30, windowSec: 60 },
  imagem: { bucket: "api:imagem", limit: 600, windowSec: 60 },
  admin: { bucket: "api:admin", limit: 100, windowSec: 60 },
  search: { bucket: "api:search", limit: 40, windowSec: 60 },
  mutation: { bucket: "api:mutation", limit: 20, windowSec: 60 },
} as const satisfies Record<string, RateLimitConfig>;

export function getClientIp(request: Request): string {
  // Only infrastructure explicitly selected by the deployment may supply identity.
  const header = process.env.VERCEL
    ? "x-vercel-forwarded-for"
    : process.env.TRUSTED_PROXY_IP_HEADER;
  const allowed = new Set([
    "x-vercel-forwarded-for",
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
  ]);
  if (!header || !allowed.has(header)) return "unknown";
  const raw = request.headers.get(header)?.split(",")[0]?.trim();
  return raw && raw.length <= 64 && /^[0-9a-f:.]+$/i.test(raw)
    ? raw
    : "unknown";
}

function memoryRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  gc(now);

  const store = getStore();
  const fullKey = `${config.bucket}:${key}`;
  const windowMs = config.windowSec * 1000;
  let bucket = store.get(fullKey);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(fullKey, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, config.limit - bucket.count);
  const success = bucket.count <= config.limit;

  return {
    success,
    limit: config.limit,
    remaining,
    reset: bucket.resetAt,
  };
}

function hasUpstash(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

/**
 * Fixed window via Upstash REST (INCR + EXPIRE na 1ª contagem).
 * Funciona em Edge e multi-instância.
 */
async function upstashRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const script =
    "local n=redis.call('INCR',KEYS[1]); local t=redis.call('PTTL',KEYS[1]); if t<0 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); t=tonumber(ARGV[1]); end; return {n,t}";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        script,
        "1",
        "rl:" + config.bucket + ":" + key,
        String(config.windowSec * 1000),
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("rate limit backend unavailable");
    const data = (await res.json()) as {
      result?: [number, number];
      error?: string;
    };
    if (data.error || !Array.isArray(data.result))
      throw new Error("invalid rate limit response");
    const [count, ttl] = data.result.map(Number);
    if (
      !Number.isFinite(count) ||
      count < 1 ||
      !Number.isFinite(ttl) ||
      ttl < 0
    )
      throw new Error("invalid rate limit counters");
    return {
      success: count <= config.limit,
      limit: config.limit,
      remaining: Math.max(0, config.limit - count),
      reset: Date.now() + ttl,
    };
  } catch {
    console.error("[rate-limit] shared counter unavailable");
    if (process.env.NODE_ENV === "production")
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: Date.now() + 3000,
      };
    return memoryRateLimit(key, config);
  }
}

/**
 * Rate limit síncrono (apenas memória). Preferir `rateLimitCheck` nas rotas.
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  return memoryRateLimit(key, config);
}

/**
 * Rate limit assíncrono: Upstash se configurado, senão memória.
 * Use este nas rotas e no middleware.
 */
export async function rateLimitCheck(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (hasUpstash()) {
    return upstashRateLimit(key, config);
  }
  return memoryRateLimit(key, config);
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
    ...(result.success
      ? {}
      : {
          "Retry-After": String(
            Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
          ),
        }),
  };
}

/** Reseta o store em memória (útil em testes). Não afeta Redis. */
export function __resetRateLimitStoreForTests() {
  getStore().clear();
}
