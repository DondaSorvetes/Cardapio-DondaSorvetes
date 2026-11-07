import type { Metadata } from "next";
import PaginaCupons from "@/components/paginas/PaginaCupons";
import { listarCuponsDisponiveis, type CupomVitrine } from "@/lib/cupons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cupons de desconto — Sorvetes Donda",
  description: "Veja os cupons de desconto disponíveis na Sorvetes Donda.",
};

export default async function Cupons() {
  let cupons: CupomVitrine[] = [];
  let erro = false;
  try {
    cupons = await listarCuponsDisponiveis();
  } catch {
    erro = true;
  }
  return <PaginaCupons cupons={cupons} erro={erro} />;
}
