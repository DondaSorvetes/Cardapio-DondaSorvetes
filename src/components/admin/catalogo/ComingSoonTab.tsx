"use client";

import { CatalogEmpty } from "./CatalogEmpty";

export function ComingSoonTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#F9FAFB] p-6">
      <div className="max-w-sm w-full rounded-md border border-[#E5E7EB] bg-white">
        <CatalogEmpty kind="coming" />
        <div className="px-6 pb-6 -mt-6 text-center">
          <h3 className="text-[15px] font-semibold text-[#111827] mb-1">
            {title}
          </h3>
          <p className="text-[13px] text-[#6B7280] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
