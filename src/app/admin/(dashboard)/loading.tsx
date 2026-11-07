/**
 * Feedback imediato ao trocar de página pela sidebar.
 * O layout (sidebar + topbar) permanece; só o conteúdo mostra o skeleton.
 */
export default function AdminDashboardLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="space-y-8 max-w-[1800px] mx-auto">
        <div>
          <div className="h-8 w-48 rounded-lg bg-[#E5E7EB]" />
          <div className="mt-2 h-4 w-72 rounded bg-[#F3F4F6]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 rounded-2xl border border-[#E5E7EB] bg-white p-6"
            >
              <div className="mb-4 h-10 w-10 rounded-xl bg-[#F3F4F6]" />
              <div className="mb-2 h-3 w-20 rounded bg-[#F3F4F6]" />
              <div className="h-7 w-28 rounded bg-[#E5E7EB]" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 h-80 rounded-2xl border border-[#E5E7EB] bg-white" />
          <div className="h-80 rounded-2xl border border-[#E5E7EB] bg-white" />
        </div>

        <div className="h-64 rounded-2xl border border-[#E5E7EB] bg-white" />
      </div>
    </div>
  );
}
