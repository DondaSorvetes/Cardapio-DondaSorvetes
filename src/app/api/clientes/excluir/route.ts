import { cookies } from "next/headers";
import { createServerClient } from "@/integrations/supabase/client.server";
import { obterSessao, revogarToken } from "@/lib/auth";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiError,
  apiOk,
  apiServerError,
  apiUnauthorized,
} from "@/lib/security/api-response";
import { securityLog } from "@/lib/security/logger";

/** Pedidos que ainda dependem do nome, telefone e endereço do cliente. */
const STATUS_EM_ANDAMENTO = ["pendente", "confirmado", "preparando", "saiu_entrega"];

/**
 * Exclusão da conta pelo próprio cliente (LGPD).
 * - Apaga o cadastro (nome, telefone, endereços salvos).
 * - Pedidos antigos continuam para o histórico de vendas da loja, sem dados
 *   pessoais: nome vira "Cliente removido"; telefone, endereço e observações
 *   são apagados; cliente_id vira null (FK ON DELETE SET NULL).
 * - Bloqueada enquanto houver pedido em andamento.
 * - Encerra a sessão atual.
 */
export const DELETE = withApiGuard(
  {
    methods: ["DELETE"],
    rateLimit: RATE_LIMITS.apiStrict,
    checkOrigin: true,
  },
  async (_request, { ip }) => {
    try {
      const sessao = await obterSessao();
      if (!sessao) return apiUnauthorized();

      const supabase = createServerClient();

      const { count: emAndamento, error: andamentoError } = await supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", sessao.id)
        .in("status", STATUS_EM_ANDAMENTO);
      if (andamentoError) return apiServerError(andamentoError);
      if ((emAndamento ?? 0) > 0) {
        return apiError(
          "Você tem um pedido em andamento. Exclua a conta depois que ele for entregue ou cancelado.",
          409,
          { codigo: "ORDER_IN_PROGRESS" },
        );
      }

      const { error: anonimizarError } = await supabase
        .from("pedidos")
        .update({
          cliente_nome: "Cliente removido",
          cliente_telefone: "",
          endereco_id: null,
          endereco_completo: null,
          troco_para: null,
          observacoes: null,
        })
        .eq("cliente_id", sessao.id);
      if (anonimizarError) return apiServerError(anonimizarError);

      const { error: excluirError } = await supabase
        .from("clientes")
        .delete()
        .eq("id", sessao.id);
      if (excluirError) return apiServerError(excluirError);

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
        event: "auth.account_deleted",
        ip,
        userId: sessao.id,
        path: "/api/clientes/excluir",
        result: "ok",
      });

      return apiOk({ mensagem: "Conta excluída" });
    } catch (erro) {
      return apiServerError(erro);
    }
  },
);
