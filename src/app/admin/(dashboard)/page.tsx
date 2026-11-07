import { getDashboardData } from "@/actions/admin/dashboard";
import { DashboardView } from "@/components/admin/dashboard/DashboardView";
import { requirePageAccess } from "@/lib/admin/auth";

export const metadata = {
  title: "Dashboard | Donda Admin",
  description: "Visão geral do estabelecimento",
};

export default async function AdminDashboardPage() {
  await requirePageAccess("dashboard");
  const data = await getDashboardData("hoje");

  return <DashboardView initialData={data} />;
}
