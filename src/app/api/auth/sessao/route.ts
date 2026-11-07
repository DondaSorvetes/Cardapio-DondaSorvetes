import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { apiOk, apiServerError } from "@/lib/security/api-response";
import { getCustomerSession } from "@/lib/customer-session.server";
export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.apiStrict, checkOrigin: false },
  async () => {
    try {
      const cliente = await getCustomerSession();
      return apiOk({ autenticado: Boolean(cliente), cliente }, 200, {
        "Cache-Control": "private, no-store",
      });
    } catch (error) {
      return apiServerError(error);
    }
  },
);
