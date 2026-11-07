/**
 * Logs estruturados (JSON) — prontos para Sentry/Datadog no futuro.
 * Nunca logar tokens, senhas ou service role.
 */

export type SecurityEvent =
  | "auth.login.success"
  | "auth.login.fail"
  | "auth.register"
  | "auth.logout"
  | "auth.account_deleted"
  | "auth.admin.denied"
  | "pedido.create"
  | "pedido.status"
  | "admin.action"
  | "rate_limit"
  | "security.blocked"
  | "upload"
  | "api.error";

type LogPayload = {
  event: SecurityEvent;
  level?: "info" | "warn" | "error";
  userId?: string | null;
  ip?: string | null;
  path?: string | null;
  result?: "ok" | "fail" | "denied";
  meta?: Record<string, unknown>;
};

function redact(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const seen = new WeakSet<object>();
  function visit(value: unknown, depth = 0): unknown {
    if (value === null || typeof value !== "object") return value;
    if (depth >= 8 || seen.has(value)) return "[REDACTED]";
    seen.add(value);
    if (Array.isArray(value))
      return value.slice(0, 100).map((item) => visit(item, depth + 1));
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          /password|senha|token|secret|authorization|cookie/i.test(key)
            ? "[REDACTED]"
            : visit(item, depth + 1),
        ]),
    );
  }
  return visit(meta);
}

export function securityLog(payload: LogPayload) {
  const line = {
    ts: new Date().toISOString(),
    service: "donda",
    level: payload.level ?? "info",
    event: payload.event,
    userId: payload.userId ?? null,
    ip: payload.ip ?? null,
    path: payload.path ?? null,
    result: payload.result ?? "ok",
    meta: redact(payload.meta),
  };

  const msg = JSON.stringify(line);
  if (payload.level === "error") console.error(msg);
  else if (payload.level === "warn") console.warn(msg);
  else console.info(msg);
}
