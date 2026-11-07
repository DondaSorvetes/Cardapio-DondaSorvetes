"use client";

import { useState, useEffect } from "react";
import { Cliente } from "@/types/cliente";
import { Pedido, statusConfig } from "@/types/pedido";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Copy,
  ExternalLink,
  FileText,
  Home,
  ShoppingBag,
  Loader2,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { StorageImage as Image } from "@/components/ui/storage-image";

interface ClienteDetailPanelProps {
  cliente: Cliente;
}

export function ClienteDetailPanel({ cliente }: ClienteDetailPanelProps) {
  const [copying, setCopying] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const supabase = createClient();

  const iniciais = cliente.nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Buscar pedidos do cliente
  useEffect(() => {
    async function fetchPedidos() {
      setLoadingPedidos(true);
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar pedidos:", error);
      } else {
        setPedidos(data as Pedido[] || []);
      }
      setLoadingPedidos(false);
    }

    fetchPedidos();
  }, [cliente.id, supabase]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const openWhatsApp = () => {
    if (cliente.telefone) {
      const phone = cliente.telefone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }
  };

  const openMaps = (endereco: string) => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`,
      "_blank"
    );
  };

  return (
    <div className="admin-client-detail min-w-0 flex-1 min-h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-3 sm:px-6 py-4 border-b border-[#E5E7EB]">
        <div className="flex items-start gap-4 mb-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C8285F] to-[#E33E70] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {iniciais}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#111827] mb-1">
              {cliente.nome}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-[#6B7280]">
              {cliente.telefone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  <span>{cliente.telefone}</span>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  <span>{cliente.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {cliente.telefone && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(cliente.telefone)}
              >
                <Copy className="w-4 h-4 mr-2" />
                {copying ? "Copiado!" : "Copiar Telefone"}
              </Button>
              <Button
                size="sm"
                onClick={openWhatsApp}
                className="bg-[#25D366] hover:bg-[#20BA5A]"
              >
                <Phone className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="informacoes" className="min-w-0 flex-1 flex flex-col">
        <div className="overflow-x-auto px-3 sm:px-6 border-b border-[#E5E7EB]">
          <TabsList className="h-12 bg-transparent p-0 gap-1">
            <TabsTrigger
              value="informacoes"
              className="data-[state=active]:bg-[#FDE6EE] data-[state=active]:text-[#C8285F] rounded-lg px-4"
            >
              <User className="w-4 h-4 mr-2" />
              Informações
            </TabsTrigger>
            <TabsTrigger
              value="enderecos"
              className="data-[state=active]:bg-[#FDE6EE] data-[state=active]:text-[#C8285F] rounded-lg px-4"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Endereços
            </TabsTrigger>
            <TabsTrigger
              value="pedidos"
              className="data-[state=active]:bg-[#FDE6EE] data-[state=active]:text-[#C8285F] rounded-lg px-4"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Pedidos ({pedidos.length})
            </TabsTrigger>
            <TabsTrigger
              value="estatisticas"
              className="data-[state=active]:bg-[#FDE6EE] data-[state=active]:text-[#C8285F] rounded-lg px-4"
            >
              <FileText className="w-4 h-4 mr-2" />
              Estatísticas
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-w-0 flex-1">
          {/* Aba: Informações */}
          <TabsContent value="informacoes" className="p-3 sm:p-6 space-y-5 mt-0">
            <section>
              <h3 className="font-semibold text-[#111827] mb-3 text-sm flex flex-wrap items-center gap-2">
                <User className="w-4 h-4 text-[#C8285F]" />
                Dados do Cliente
              </h3>
              <div className="bg-[#F8F9FC] rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-[#6B7280]">Nome Completo</span>
                  <span className="text-sm font-medium text-[#111827]">
                    {cliente.nome}
                  </span>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-[#6B7280]">Telefone</span>
                  <span className="text-sm font-medium text-[#111827]">
                    {cliente.telefone || "Não informado"}
                  </span>
                </div>
                {cliente.email && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-[#6B7280]">E-mail</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {cliente.email}
                      </span>
                    </div>
                  </>
                )}
                {cliente.cpf && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-[#6B7280]">CPF</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {cliente.cpf}
                      </span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-[#6B7280]">ID do Cliente</span>
                  <span className="text-sm font-mono text-[#111827]">
                    {cliente.id.slice(0, 8)}
                  </span>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-[#6B7280]">Cliente desde</span>
                  <span className="text-sm font-medium text-[#111827]">
                    {format(new Date(cliente.created_at), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* Aba: Endereços */}
          <TabsContent value="enderecos" className="p-3 sm:p-6 space-y-5 mt-0">
            {cliente.enderecos_adicionais && cliente.enderecos_adicionais.length > 0 ? (
              cliente.enderecos_adicionais.map((endereco) => (
                <section key={endereco.id} className="bg-[#F8F9FC] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Home className="w-4 h-4 text-[#C8285F]" />
                      <h4 className="font-semibold text-[#111827]">
                        {endereco.apelido || "Endereço"}
                      </h4>
                      {endereco.principal && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#C8285F] text-white">
                          Principal
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const enderecoCompleto = `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade}/${endereco.estado}`;
                        openMaps(enderecoCompleto);
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm text-[#111827]">
                    <p>
                      {endereco.logradouro}, {endereco.numero}
                      {endereco.complemento && ` - ${endereco.complemento}`}
                    </p>
                    <p>
                      {endereco.bairro} - {endereco.cidade}/{endereco.estado}
                    </p>
                    <p className="text-[#6B7280]">CEP: {endereco.cep}</p>
                  </div>
                </section>
              ))
            ) : (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
                <p className="text-sm text-[#6B7280]">
                  Nenhum endereço cadastrado
                </p>
              </div>
            )}
          </TabsContent>

          {/* Aba: Pedidos */}
          <TabsContent value="pedidos" className="p-3 sm:p-6 space-y-3 mt-0">
            {loadingPedidos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#C8285F] animate-spin" />
              </div>
            ) : pedidos.length > 0 ? (
              pedidos.map((pedido) => {
                const statusInfo = statusConfig[pedido.status];
                return (
                  <div
                    key={pedido.id}
                    className="bg-[#F8F9FC] rounded-xl p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-semibold text-[#111827] text-sm">
                            Pedido #{pedido.id.slice(0, 8)}
                          </h4>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-lg border",
                              statusInfo.color
                            )}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#C8285F]">
                          R$ {parseFloat(String(pedido.total)).toFixed(2).replace(".", ",")}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {pedido.itens?.length || 0} {pedido.itens?.length === 1 ? "item" : "itens"}
                        </p>
                      </div>
                    </div>

                    {/* Itens do pedido */}
                    {pedido.itens && pedido.itens.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-[#E5E7EB]">
                        {pedido.itens.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            {item.produto?.image ? (
                              <Image
                                src={item.produto.image}
                                alt={item.produto.name}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                                <Package className="w-5 h-5 text-[#6B7280]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#111827] truncate">
                                {item.qty}x {item.produto?.name}
                              </p>
                              <p className="text-xs text-[#6B7280]">
                                R$ {parseFloat(String(item.total)).toFixed(2).replace(".", ",")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
                <p className="text-sm text-[#6B7280]">
                  Nenhum pedido realizado ainda
                </p>
              </div>
            )}
          </TabsContent>

          {/* Aba: Estatísticas */}
          <TabsContent value="estatisticas" className="p-3 sm:p-6 space-y-5 mt-0">
            <section>
              <h3 className="font-semibold text-[#111827] mb-3 text-sm">
                Resumo de Compras
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#F8F9FC] rounded-xl p-4">
                  <p className="text-xs text-[#6B7280] mb-1">Total de Pedidos</p>
                  <p className="text-2xl font-bold text-[#111827]">
                    {cliente.total_pedidos || 0}
                  </p>
                </div>
                <div className="bg-[#F8F9FC] rounded-xl p-4">
                  <p className="text-xs text-[#6B7280] mb-1">Total Gasto</p>
                  <p className="text-2xl font-bold text-[#C8285F]">
                    R$ {(cliente.total_gasto || 0).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div className="bg-[#F8F9FC] rounded-xl p-4">
                  <p className="text-xs text-[#6B7280] mb-1">Ticket Médio</p>
                  <p className="text-2xl font-bold text-[#111827]">
                    R$ {(cliente.ticket_medio || 0).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div className="bg-[#F8F9FC] rounded-xl p-4">
                  <p className="text-xs text-[#6B7280] mb-1">Último Pedido</p>
                  <p className="text-sm font-medium text-[#111827]">
                    {cliente.ultimo_pedido
                      ? format(new Date(cliente.ultimo_pedido), "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "Nunca"}
                  </p>
                </div>
              </div>
            </section>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
