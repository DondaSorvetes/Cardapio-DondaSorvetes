"use client";

import { StorageImage as Image } from "@/components/ui/storage-image";
import { TrendingUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  nome: string;
  categoria: string;
  imagem?: string;
  quantidade: number;
  receita: number;
}

interface PremiumTopProductsProps {
  title?: string;
  products: Product[];
}

export function PremiumTopProducts({
  title = "Produtos Mais Vendidos",
  products,
}: PremiumTopProductsProps) {
  const maxReceita = Math.max(...products.map((p) => p.receita));

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition-all duration-200">
      <div className="p-6 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
            <p className="text-sm text-[#6B7280] mt-1">Top {products.length} do mês</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FDE6EE] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#C8285F]" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {products.map((product, index) => {
          const progressPercentage = (product.receita / maxReceita) * 100;

          return (
            <div key={product.id} className="group">
              <div className="flex items-center gap-4">
                {/* Ranking */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0",
                    index === 0 && "bg-[#FDE6EE] text-[#C8285F]",
                    index === 1 && "bg-gray-100 text-gray-700",
                    index === 2 && "bg-amber-50 text-amber-700",
                    index > 2 && "bg-gray-50 text-gray-500"
                  )}
                >
                  {index + 1}
                </div>

                {/* Image */}
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                  {product.imagem ? (
                    <Image
                      src={product.imagem}
                      alt={product.nome}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111827] truncate">
                    {product.nome}
                  </p>
                  <p className="text-xs text-[#6B7280]">{product.categoria}</p>
                </div>

                {/* Stats */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-[#111827]">
                    R$ {product.receita.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {product.quantidade} vendas
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    index === 0 && "bg-gradient-to-r from-[#C8285F] to-[#E33E70]",
                    index === 1 && "bg-gradient-to-r from-gray-400 to-gray-500",
                    index === 2 && "bg-gradient-to-r from-amber-400 to-amber-500",
                    index > 2 && "bg-gray-300"
                  )}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
