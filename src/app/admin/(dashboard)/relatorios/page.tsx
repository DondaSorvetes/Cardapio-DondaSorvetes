import { requirePageAccess } from "@/lib/admin/auth";
import { RelatoriosManager } from "@/components/admin/relatorios/RelatoriosManager";

export const metadata = {
  title: "Relatórios | Donda Admin",
  description: "Relatórios e indicadores de desempenho da loja",
};

export default async function AdminReportsPage() {
  await requirePageAccess("relatorios");

  return <RelatoriosManager />;
}
