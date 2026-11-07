import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";
import { FormularioEndereco } from "@/components/enderecos/FormularioEndereco";
export default async function NovoEnderecoPage({
  searchParams,
}: {
  searchParams: Promise<{ cep?: string | string[] }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/auth");
  const { cep } = await searchParams;
  const cepInicial = typeof cep === "string" ? cep.replace(/\D/g, "").slice(0, 8) : undefined;
  return <FormularioEndereco cepInicial={cepInicial} />;
}
