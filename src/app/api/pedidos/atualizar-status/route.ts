import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/integrations/supabase/client.server";
import { requirePermissionApi } from "@/lib/admin/auth";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiForbidden,
  apiOk,
  apiServerError,
  apiUnauthorized,
  apiValidation,
} from "@/lib/security/api-response";
import { securityLog } from "@/lib/security/logger";
import { writeAudit } from "@/lib/security/audit";

const schema = z.object({
  orderId: z.string().uuid().or(z.string().min(1).max(64)),
  status: z.enum([
    "pendente",
    "confirmado",
    "preparando",
    "saiu_entrega",
    "entregue",
    "cancelado",
  ]),
});

export const PATCH = withApiGuard(
  {
    methods: ["PATCH"],
    rateLimit: RATE_LIMITS.admin,
    checkOrigin: true,
  },
  async (request: NextRequest, { ip }) => {
    try {
      let admin;
      try {
        admin = await requirePermissionApi("pedido:update_status");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        securityLog({
          event: "auth.admin.denied",
          level: "warn",
          ip,
          path: "/api/pedidos/atualizar-status",
          result: "denied",
        });
        if (msg === "UNAUTHORIZED") return apiUnauthorized();
        return apiForbidden();
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return apiValidation("Corpo inválido");
      }

      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return apiValidation("ID do pedido ou status inválido");
      }

      const { orderId, status } = parsed.data;
      const supabase = createServerClient();

      const { data: before } = await supabase
        .from("pedidos")
        .select("id, status")
        .eq("id", orderId)
        .maybeSingle();

      const { data, error } = await supabase
        .from("pedidos")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select("id, status, updated_at")
        .maybeSingle();

      if (error || !data) {
        return apiServerError(error);
      }

      await writeAudit({
        actorId: admin.admin.id,
        actorEmail: admin.admin.email,
        action: "pedido.status_update",
        entity: "pedidos",
        entityId: orderId,
        ip,
        before: before ?? null,
        after: data,
        result: "ok",
      });

      securityLog({
        event: "pedido.status",
        ip,
        userId: admin.admin.id,
        path: "/api/pedidos/atualizar-status",
        result: "ok",
        meta: { orderId, status },
      });

      return apiOk({ success: true, order: data });
    } catch (error) {
      return apiServerError(error);
    }
  }
);
