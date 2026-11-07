"use client";

import {
  Bell,
  Search,
  Plus,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  adminName?: string;
  adminEmail?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function Header({ adminName, adminEmail, breadcrumbs }: HeaderProps) {
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const initials = adminName
    ? adminName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left Section - Breadcrumbs */}
          <div className="flex-1 min-w-0">
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <nav className="flex items-center gap-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {crumb.href ? (
                      <a
                        href={crumb.href}
                        className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="text-gray-900 font-semibold">
                        {crumb.label}
                      </span>
                    )}
                    {index < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                ))}
              </nav>
            ) : (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                  {today}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Bem-vindo de volta!
                  </h2>
                  <Sparkles className="w-4 h-4 text-[#C8285F]" />
                </div>
              </div>
            )}
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden lg:flex items-center gap-2.5 px-4 py-2 bg-gray-50/80 hover:bg-gray-100/80 rounded-xl border border-gray-200/50 transition-all duration-200 w-80 group">
              <Search className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors duration-200" />
              <input
                type="text"
                placeholder="Buscar pedidos, clientes..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-500"
              />
              <kbd className="hidden xl:inline-flex px-2 py-1 text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-md">
                ⌘K
              </kbd>
            </div>

            {/* Create Order Button */}
            <Button
              size="sm"
              className="hidden md:flex items-center gap-2 bg-[#C8285F] hover:bg-[#3d1e70] text-white shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Novo Pedido
            </Button>

            {/* Notifications */}
            <button className="relative p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 group">
              <Bell className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
              >
                3
              </Badge>
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-gray-200/80">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">
                  {adminName || "Administrador"}
                </p>
                <p className="text-xs text-gray-500">
                  {adminEmail || "admin@sorvetesdonda.com.br"}
                </p>
              </div>
              <Avatar className="h-9 w-9 ring-2 ring-gray-100 hover:ring-[#C8285F]/20 transition-all duration-200 cursor-pointer">
                <AvatarFallback className="bg-gradient-to-br from-[#C8285F] to-[#6b3cb0] text-white text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
