import type { Endereco } from "@/types/endereco";

/** Old installations can store the JSON array as a string. Never overwrite it as an empty list. */
export function parseAdditionalAddresses(value: unknown): Endereco[] {
  if (value == null || value === "") return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed))
    throw Error("Não foi possível ler os endereços cadastrados.");
  return parsed as Endereco[];
}

/** An explicitly selected additional address takes precedence over the legacy address. */
export function customerAddresses(cliente: {
  endereco?: string | null;
  enderecos_adicionais?: unknown;
}): Endereco[] {
  const additional = parseAdditionalAddresses(cliente.enderecos_adicionais);
  const legacy = cliente.endereco;
  const addresses: Endereco[] = legacy
    ? [
        {
          id: "endereco-legado",
          apelido: "Endereço do cadastro",
          logradouro: legacy.split(",")[0]?.trim() || "",
          numero: legacy.split(",")[1]?.split("-")[0]?.trim() || "",
          complemento: "",
          bairro: legacy.split("-")[1]?.split(",")[0]?.trim() || "",
          cidade: legacy.split(",")[2]?.split("/")[0]?.trim() || "",
          estado: legacy.split("/")[1]?.split("-")[0]?.trim() || "",
          cep: legacy.match(/CEP:\s*(\d+)/)?.[1] || "",
          principal: false,
          created_at: "",
        },
        ...additional,
      ]
    : additional;
  const primaryId =
    additional.find((address) => address.principal)?.id || addresses[0]?.id;
  return addresses.map((address) => ({
    ...address,
    principal: address.id === primaryId,
  }));
}
