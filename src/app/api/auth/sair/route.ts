import { cookies } from "next/headers";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { apiOk } from "@/lib/security/api-response";
import { securityLog } from "@/lib/security/logger";
import { obterSessao, revogarToken } from "@/lib/auth";

export const POST = withApiGuard(
  {
    methods: ["POST"],
    rateLimit: RATE_LIMITS.apiStrict,
    checkOrigin: true,
  },
  async (_request, { ip }) => {
    const sessao = await obterSessao();
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (token) await revogarToken(token);
    cookieStore.set("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    securityLog({
      event: "auth.logout",
      ip,
      userId: sessao?.id,
      path: "/api/auth/sair",
      result: "ok",
    });

    return apiOk({ mensagem: "Sessão encerrada" });
  },
);
