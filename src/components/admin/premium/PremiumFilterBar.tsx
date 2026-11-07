"use client";

import { Search, Filter, Download, RefreshCw } from "lucide-react";
import { useState } from "react";

interface PremiumFilterBarProps {
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onFilter?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  showExport?: boolean;
  showRefresh?: boolean;
  showFilter?: boolean;
}

export function PremiumFilterBar({
  searchPlaceholder = "Buscar...",
  onSearch,
  onFilter,
  onExport,
  onRefresh,
  showExport = true,
  showRefresh = true,
  showFilter = true,
}: PremiumFilterBarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-11 pl-12 pr-4 bg-[#F7F8FC] border border-transparent rounded-xl text-sm text-[#111827] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#C8285F] focus:bg-white transition-all duration-200"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {showFilter && (
            <button
              onClick={onFilter}
              className="h-11 px-4 flex items-center gap-2 bg-[#F7F8FC] hover:bg-[#FDE6EE] text-[#6B7280] hover:text-[#C8285F] rounded-xl transition-all duration-200 font-medium text-sm"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filtros</span>
            </button>
          )}

          {showExport && (
            <button
              onClick={onExport}
              className="h-11 px-4 flex items-center gap-2 bg-[#F7F8FC] hover:bg-[#FDE6EE] text-[#6B7280] hover:text-[#C8285F] rounded-xl transition-all duration-200 font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}

          {showRefresh && (
            <button
              onClick={onRefresh}
              className="h-11 w-11 flex items-center justify-center bg-[#F7F8FC] hover:bg-[#FDE6EE] text-[#6B7280] hover:text-[#C8285F] rounded-xl transition-all duration-200"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
