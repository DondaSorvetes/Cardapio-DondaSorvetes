import { getPreferenciasEstabelecimento } from "@/actions/admin/estabelecimento-settings";
import { SistemaConfigManager } from "@/components/admin/sistema";
import { DEFAULT_PREFERENCIAS_ESTABELECIMENTO } from "@/types/estabelecimento-settings";
import { requirePageAccess } from "@/lib/admin/auth";

export const metadata = {
  title: "Configurações | Donda Admin",
  description: "Pedidos, impressão, notificações e preferências do sistema",
};

export default async function ConfiguracoesPage() {
  await requirePageAccess("configuracoes");

  let preferencias = DEFAULT_PREFERENCIAS_ESTABELECIMENTO;

  try {
    preferencias = await getPreferenciasEstabelecimento();
  } catch (error) {
    console.error("Erro ao carregar preferências:", error);
  }

  return <SistemaConfigManager preferenciasIniciais={preferencias} />;
}
