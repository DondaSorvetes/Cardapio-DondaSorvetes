import { requireAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/premium/AdminShell";
import { AccessGuard } from "@/components/admin/AccessGuard";
import { hasPermission, roleLabel } from "@/lib/security/rbac";

/**
 * Shell do admin. Auth + perfil em public.perfis.
 * Config da loja NÃO é buscada no layout — o StoreStatusCard carrega no cliente.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const { admin, role, acessos } = session;
  const adminEmail = admin.email || "";
  const adminName = admin.nome || adminEmail.split("@")[0] || "Admin";
  const roleName = roleLabel(role);
  const canManageStore = hasPermission(
    role,
    "config:write",
    session.permissoes
  );

  return (
    <AccessGuard acessos={acessos}>
      <AdminShell
        adminEmail={adminEmail}
        adminName={adminName}
        roleLabel={roleName}
        acessos={acessos}
        canManageStore={canManageStore}
        canAutoPrint={hasPermission(role, "pedido:update_status", session.permissoes)}
      >
        {children}
      </AdminShell>
    </AccessGuard>
  );
}
