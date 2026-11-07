import type { Metadata } from "next";
import PaginaInicio from "@/components/paginas/PaginaInicio";
import { fetchMenuSnapshot } from "@/data/cardapio";
import { fetchLojaResumo } from "@/data/loja";
import { PublicDataProvider } from "@/context/PublicDataContext";
import type { ConfiguracoesLoja } from "@/hooks/useLoja";

// Public catalog only; a new deploy invalidates HTML, and ISR refreshes it every 30s.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Sorvetes Donda — Delivery online",
  description:
    "Peça seu sorvete online na Sorvetes Donda. Escolha seu sabor favorito com entrega em Poloni - SP.",
};

export default async function Home() {
  const [menu, loja] = await Promise.allSettled([
    fetchMenuSnapshot(),
    fetchLojaResumo(),
  ]);
  return (
    <PublicDataProvider
      value={{
        categories: menu.status === "fulfilled" ? menu.value.categorias : undefined,
        loja:
          loja.status === "fulfilled"
            ? (loja.value as ConfiguracoesLoja | null)
            : undefined,
        generatedAt: Date.now(),
      }}
    >
      <PaginaInicio />
    </PublicDataProvider>
  );
}
