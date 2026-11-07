"use server";

import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { securityLog } from "./logger";

export type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  ip?: string | null;
  before?: unknown;
  after?: unknown;
  result?: "ok" | "fail" | "denied";
  meta?: Record<string, unknown>;
};

/**
 * Persiste auditoria em `audit_logs` se a tabela existir.
 * Sempre emite log estruturado (não bloqueia o fluxo se o DB falhar).
 */
export async function writeAudit(input: AuditInput) {
  securityLog({
    event: "admin.action",
    userId: input.actorId,
    ip: input.ip,
    result: input.result ?? "ok",
    meta: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      ...input.meta,
    },
  });

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("audit_logs" as never).insert({
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      ip: input.ip ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      result: input.result ?? "ok",
      meta: input.meta ?? null,
      created_at: new Date().toISOString(),
    } as never);
    if (error) throw new Error("Falha ao persistir auditoria");
  } catch {
    securityLog({
      event: "api.error",
      level: "error",
      path: "audit_logs",
      result: "fail",
      meta: { reason: "audit_persistence_failed" },
    });
  }
}
