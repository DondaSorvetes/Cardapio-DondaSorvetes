import { createServerClient } from "@/integrations/supabase/client.server";
import { apiOk, apiServerError } from "@/lib/security/api-response";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.catalogo, checkOrigin: false },
  async () => {
    try {
      const supabase = createServerClient();
      const [{ data: produtos, error: produtosError }, { data: combos, error: combosError }] =
        await Promise.all([
          supabase
            .from("produtos")
            .select("preco_base, preco_promocional")
            .eq("esta_disponivel", true)
            .not("preco_promocional", "is", null),
          supabase.from("combos").select("id, preco").eq("ativa", true),
        ]);
      if (produtosError) throw produtosError;
      if (combosError) throw combosError;

      const produtosEmPromocao = (produtos ?? []).filter((produto) => {
        const base = Number(produto.preco_base) || 0;
        const promocional = Number(produto.preco_promocional);
        return promocional > 0 && promocional < base;
      }).length;

      const comboIds = (combos ?? []).map((combo) => combo.id);
      let combosEmPromocao = 0;
      if (comboIds.length) {
        const [{ data: itens, error: itensError }, { data: produtosBase, error: baseError }] =
          await Promise.all([
            supabase
              .from("combo_itens")
              .select("combo_id, produto_id, quantidade")
              .in("combo_id", comboIds),
            supabase.from("produtos").select("id, preco_base"),
          ]);
        if (itensError) throw itensError;
        if (baseError) throw baseError;

        const precoPorProduto = new Map(
          (produtosBase ?? []).map((produto) => [produto.id, Number(produto.preco_base) || 0])
        );
        const precoCombo = new Map((combos ?? []).map((combo) => [combo.id, Number(combo.preco)]));
        const totalPorCombo = new Map<number, { quantidade: number; referencia: number }>();
        for (const item of itens ?? []) {
          const atual = totalPorCombo.get(item.combo_id) ?? { quantidade: 0, referencia: 0 };
          atual.quantidade += 1;
          atual.referencia += (precoPorProduto.get(item.produto_id) ?? 0) * item.quantidade;
          totalPorCombo.set(item.combo_id, atual);
        }
        combosEmPromocao = [...totalPorCombo.entries()].filter(([id, total]) =>
          total.quantidade >= 2 && (precoCombo.get(id) ?? 0) < total.referencia
        ).length;
      }

      return apiOk({ count: produtosEmPromocao + combosEmPromocao });
    } catch (error) {
      return apiServerError(error);
    }
  }
);
