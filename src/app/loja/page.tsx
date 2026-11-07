import type { Metadata } from "next";
import PaginaLoja from "@/components/paginas/PaginaLoja";
import { fetchLojaDetalhes, fetchLojaResumo } from "@/data/loja";
import { PublicDataProvider } from "@/context/PublicDataContext";
import type { ConfiguracoesLoja } from "@/hooks/useLoja";

// Dados públicos da loja; atualiza a cada 30s como a página inicial.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Informações da loja — Sorvetes Donda",
  description: "Endereço, horário de funcionamento, entrega e formas de pagamento.",
};

export default async function Loja() {
  const [loja, detalhes] = await Promise.allSettled([fetchLojaResumo(), fetchLojaDetalhes()]);
  return (
    <PublicDataProvider
      value={{
        loja: loja.status === "fulfilled" ? (loja.value as ConfiguracoesLoja | null) : undefined,
        generatedAt: Date.now(),
      }}
    >
      <PaginaLoja
        detalhesIniciais={detalhes.status === "fulfilled" ? (detalhes.value as Partial<ConfiguracoesLoja> | null) : null}
      />
    </PublicDataProvider>
  );
}
