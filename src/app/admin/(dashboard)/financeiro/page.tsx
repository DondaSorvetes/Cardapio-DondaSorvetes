import { requirePageAccess } from "@/lib/admin/auth";

export default async function AdminFinancePage() {
  await requirePageAccess("relatorios");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-gray-500 mt-2">
          Controle financeiro completo do seu negócio
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-12 text-center">
        <div className="text-gray-400">
          <p className="text-lg">Página em desenvolvimento</p>
          <p className="text-sm mt-2">
            Em breve você terá acesso a todas as funcionalidades financeiras
          </p>
        </div>
      </div>
    </div>
  );
}
