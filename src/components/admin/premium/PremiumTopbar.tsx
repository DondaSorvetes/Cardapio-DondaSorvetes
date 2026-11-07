"use client";

import { Menu } from "lucide-react";
import { useEffect } from "react";


interface PremiumTopbarProps {
  adminName: string;
  adminEmail?: string;
  onOpenMenu?: () => void;
  menuOpen?: boolean;
}

export function PremiumTopbar({
  adminName,
  onOpenMenu,
  menuOpen,
}: PremiumTopbarProps) {
  useEffect(() => {
    if (!adminName) return;
    try {
      localStorage.setItem("donda-admin-name", adminName);
    } catch {
      // ignore
    }
  }, [adminName]);

  return (
    <header
      data-admin-name={adminName}
      className="sticky top-0 z-40 h-12 shrink-0 bg-white border-b border-[#E5E7EB] flex items-center px-3 xl:hidden"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#C8285F] hover:bg-[#FDF0F4] xl:hidden"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>

      </div>
    </header>
  );
}
