export function PremiumStatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200" />
        <div className="w-16 h-6 rounded-lg bg-gray-200" />
      </div>
      <div className="space-y-2">
        <div className="w-24 h-4 rounded bg-gray-200" />
        <div className="w-32 h-8 rounded bg-gray-200" />
        <div className="w-20 h-3 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export function PremiumChartSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 animate-pulse">
      <div className="mb-6">
        <div className="w-48 h-6 rounded bg-gray-200 mb-2" />
        <div className="w-64 h-4 rounded bg-gray-200" />
      </div>
      <div className="h-[320px] bg-gray-100 rounded-xl" />
    </div>
  );
}

export function PremiumTableSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] animate-pulse">
      <div className="p-6 border-b border-[#E5E7EB]">
        <div className="w-40 h-6 rounded bg-gray-200 mb-2" />
        <div className="w-24 h-4 rounded bg-gray-200" />
      </div>
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-full h-12 rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PremiumDashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div>
        <div className="w-48 h-8 rounded bg-gray-200 mb-2 animate-pulse" />
        <div className="w-96 h-5 rounded bg-gray-200 animate-pulse" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <PremiumStatCardSkeleton key={i} />
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <PremiumChartSkeleton />
        </div>
        <PremiumChartSkeleton />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <PremiumTableSkeleton />
        </div>
        <PremiumChartSkeleton />
      </div>
    </div>
  );
}
