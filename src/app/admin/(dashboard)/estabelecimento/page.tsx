import { ensureConfiguracoesLoja } from "@/actions/admin/configuracoes";
import { EstabelecimentoManager } from "@/components/admin/estabelecimento";
import {
  normalizeConfiguracao,
  type ConfiguracaoLoja,
} from "@/types/configuracoes";
import { requirePageAccess } from "@/lib/admin/auth";

export const metadata = {
  title: "Estabelecimento | Donda Admin",
  description: "Edite os dados da sua loja",
};

export default async function EstabelecimentoPage() {
  await requirePageAccess("estabelecimento");

  let raw: Record<string, unknown> | null = null;

  try {
    raw = (await ensureConfiguracoesLoja()) as Record<string, unknown> | null;
  } catch (error) {
    console.error("Erro ao carregar configurações da loja:", error);
  }

  const configuracao: ConfiguracaoLoja = raw
    ? normalizeConfiguracao(raw)
    : normalizeConfiguracao({
        id: 0,
        nome: "Sorvetes Donda",
        descricao: "Seguindo a tradição desde 1953!",
        esta_aberto: true,
        taxa_entrega: 5,
        pedido_minimo: 20,
        tempo_entrega_min: 30,
        tempo_entrega_max: 45,
      });

  return <EstabelecimentoManager configuracaoInicial={configuracao} />;
}
