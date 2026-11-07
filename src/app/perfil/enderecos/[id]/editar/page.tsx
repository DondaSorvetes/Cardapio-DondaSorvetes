import { notFound, redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";
import { createServerClient } from "@/integrations/supabase/client.server";
import { parseAdditionalAddresses } from "@/lib/enderecos-cliente";
import { FormularioEndereco } from "@/components/enderecos/FormularioEndereco";
export default async function EditarEndereco({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await obterSessao();
  if (!session) redirect("/entrar");
  const { id } = await params;
  const { data, error } = await createServerClient()
    .from("clientes")
    .select("enderecos_adicionais")
    .eq("id", session.id)
    .single();
  if (error) throw Error("Não foi possível carregar seu endereço.");
  const address = parseAdditionalAddresses(data?.enderecos_adicionais).find(
    (item) => item.id === id,
  );
  if (!address) notFound();
  return <FormularioEndereco endereco={address} />;
}
