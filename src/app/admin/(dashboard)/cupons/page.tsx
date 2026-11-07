import { requirePageAccess } from "@/lib/admin/auth";
import { listCupons, type Cupom } from "@/actions/admin/cupons";
import { CuponsManager } from "@/components/admin/cupons/CuponsManager";

export const metadata = {
  title: "Cupons | Donda Admin",
  description: "Criação e gerenciamento de cupons de desconto",
};

export default async function CuponsPage() {
  await requirePageAccess("cupons");
  let cupons: Cupom[] = [];
  let loadError: string | null = null;
  try {
    cupons = await listCupons();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Não foi possível carregar os cupons.";
  }
  return <CuponsManager initial={cupons} loadError={loadError} />;
}
