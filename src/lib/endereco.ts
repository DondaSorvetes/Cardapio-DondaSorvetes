import {
  parseAdditionalAddresses,
  customerAddresses,
} from "@/lib/enderecos-cliente";
import { createServerClient } from "@/integrations/supabase/client.server";
import type { Endereco, EnderecoInput } from "@/types/endereco";
import { randomUUID } from "crypto";

/**
 * Adiciona um novo endereço à lista de endereços do cliente
 */
export async function adicionarNovoEndereco(
  clienteId: string,
  novoEndereco: EnderecoInput,
): Promise<{ sucesso: boolean; endereco?: Endereco; erro?: string }> {
  try {
    const supabase = createServerClient();

    // 1. Buscar endereços atuais do cliente
    const { data: cliente, error: buscarErro } = await supabase
      .from("clientes")
      .select("endereco, enderecos_adicionais")
      .eq("id", clienteId)
      .single();

    if (buscarErro) {
      console.error("Erro ao buscar cliente:", buscarErro);
      return { sucesso: false, erro: "Cliente não encontrado" };
    }

    // 2. Parsear array de endereços existente
    let enderecosAtuais = parseAdditionalAddresses(
      cliente.enderecos_adicionais,
    );

    // 3. Se o novo endereço é principal, desmarcar outros
    if (novoEndereco.principal) {
      enderecosAtuais = enderecosAtuais.map((end) => ({
        ...end,
        principal: false,
      }));
    }

    // 4. Criar novo endereço
    const enderecoCompleto: Endereco = {
      id: randomUUID(),
      apelido: novoEndereco.apelido,
      logradouro: novoEndereco.logradouro,
      numero: novoEndereco.numero,
      complemento: novoEndereco.complemento || "",
      bairro: novoEndereco.bairro,
      cidade: novoEndereco.cidade,
      estado: novoEndereco.estado,
      cep: novoEndereco.cep,
      principal: Boolean(
        novoEndereco.principal ||
        (!cliente.endereco && enderecosAtuais.length === 0),
      ),
      created_at: new Date().toISOString(),
    };

    // 5. Adicionar à lista
    const enderecosAtualizados = [...enderecosAtuais, enderecoCompleto];

    // 6. Salvar no banco
    const { error: atualizarErro } = await supabase
      .from("clientes")
      .update({
        enderecos_adicionais: JSON.parse(JSON.stringify(enderecosAtualizados)),
      })
      .eq("id", clienteId);

    if (atualizarErro) {
      console.error("Erro ao atualizar endereços:", atualizarErro);
      return { sucesso: false, erro: "Erro ao salvar endereço" };
    }

    return { sucesso: true, endereco: enderecoCompleto };
  } catch (erro) {
    console.error("Erro ao adicionar endereço:", erro);
    return { sucesso: false, erro: "Erro interno" };
  }
}

/**
 * Remove um endereço da lista do cliente
 */
export async function removerEndereco(
  clienteId: string,
  enderecoId: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const supabase = createServerClient();

    // 1. Buscar endereços atuais
    const { data: cliente, error: buscarErro } = await supabase
      .from("clientes")
      .select("enderecos_adicionais")
      .eq("id", clienteId)
      .single();

    if (buscarErro || !cliente) {
      return { sucesso: false, erro: "Cliente não encontrado" };
    }

    // 2. Filtrar removendo o endereço
    const enderecosAtuais = parseAdditionalAddresses(
      cliente.enderecos_adicionais,
    );

    const enderecosAtualizados = enderecosAtuais.filter(
      (end) => end.id !== enderecoId,
    );

    // 3. Se removeu o principal e ainda há endereços, marcar o primeiro como principal
    if (enderecosAtualizados.length > 0) {
      const temPrincipal = enderecosAtualizados.some((end) => end.principal);
      if (!temPrincipal) {
        enderecosAtualizados[0].principal = true;
      }
    }

    // 4. Salvar no banco
    const { error: atualizarErro } = await supabase
      .from("clientes")
      .update({
        enderecos_adicionais: JSON.parse(JSON.stringify(enderecosAtualizados)),
      })
      .eq("id", clienteId);

    if (atualizarErro) {
      return { sucesso: false, erro: "Erro ao remover endereço" };
    }

    return { sucesso: true };
  } catch (erro) {
    console.error("Erro ao remover endereço:", erro);
    return { sucesso: false, erro: "Erro interno" };
  }
}

/**
 * Define um endereço como principal
 */
export async function definirEnderecoPrincipal(
  clienteId: string,
  enderecoId: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const supabase = createServerClient();

    // 1. Buscar endereços atuais
    const { data: cliente, error: buscarErro } = await supabase
      .from("clientes")
      .select("endereco, enderecos_adicionais")
      .eq("id", clienteId)
      .single();

    if (buscarErro || !cliente) {
      return { sucesso: false, erro: "Cliente não encontrado" };
    }

    // 2. Atualizar flags de principal
    const enderecosAtuais = parseAdditionalAddresses(
      cliente.enderecos_adicionais,
    );

    if (
      enderecoId === "endereco-legado"
        ? !cliente.endereco
        : !enderecosAtuais.some((end) => end.id === enderecoId)
    )
      return { sucesso: false, erro: "Endereço não encontrado" };
    const enderecosAtualizados = enderecosAtuais.map((end) => ({
      ...end,
      principal: end.id === enderecoId,
    }));

    // 3. Salvar no banco
    const { error: atualizarErro } = await supabase
      .from("clientes")
      .update({
        enderecos_adicionais: JSON.parse(JSON.stringify(enderecosAtualizados)),
      })
      .eq("id", clienteId);

    if (atualizarErro) {
      return { sucesso: false, erro: "Erro ao definir endereço principal" };
    }

    return { sucesso: true };
  } catch (erro) {
    console.error("Erro ao definir endereço principal:", erro);
    return { sucesso: false, erro: "Erro interno" };
  }
}

/**
 * Atualiza um endereço existente
 */
export async function atualizarEndereco(
  clienteId: string,
  enderecoId: string,
  dadosAtualizados: Partial<EnderecoInput>,
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const supabase = createServerClient();

    // 1. Buscar endereços atuais
    const { data: cliente, error: buscarErro } = await supabase
      .from("clientes")
      .select("enderecos_adicionais")
      .eq("id", clienteId)
      .single();

    if (buscarErro || !cliente) {
      return { sucesso: false, erro: "Cliente não encontrado" };
    }

    // 2. Atualizar o endereço específico
    const enderecosAtuais = parseAdditionalAddresses(
      cliente.enderecos_adicionais,
    );

    if (!enderecosAtuais.some((end) => end.id === enderecoId))
      return { sucesso: false, erro: "Endereço não encontrado" };
    const enderecosAtualizados = enderecosAtuais.map((end) => {
      if (end.id === enderecoId) {
        return { ...end, ...dadosAtualizados };
      }
      // Se está marcando como principal, desmarcar outros
      if (dadosAtualizados.principal && end.id !== enderecoId) {
        return { ...end, principal: false };
      }
      return end;
    });

    // 3. Salvar no banco
    const { error: atualizarErro } = await supabase
      .from("clientes")
      .update({
        enderecos_adicionais: JSON.parse(JSON.stringify(enderecosAtualizados)),
      })
      .eq("id", clienteId);

    if (atualizarErro) {
      return { sucesso: false, erro: "Erro ao atualizar endereço" };
    }

    return { sucesso: true };
  } catch (erro) {
    console.error("Erro ao atualizar endereço:", erro);
    return { sucesso: false, erro: "Erro interno" };
  }
}

/**
 * Obtém o endereço principal do cliente
 */
export async function obterEnderecoPrincipal(
  clienteId: string,
): Promise<Endereco | null> {
  try {
    const supabase = createServerClient();

    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("endereco, enderecos_adicionais")
      .eq("id", clienteId)
      .single();

    if (error || !cliente) {
      return null;
    }

    const enderecos = customerAddresses(cliente);

    return enderecos.find((end) => end.principal) || enderecos[0] || null;
  } catch (erro) {
    console.error("Erro ao obter endereço principal:", erro);
    return null;
  }
}
