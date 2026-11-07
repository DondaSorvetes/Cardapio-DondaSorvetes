"use client";

import { ConfiguracaoLoja } from "@/types/configuracoes";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { Store, Clock, Truck, DollarSign, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewLojaProps {
  config: ConfiguracaoLoja;
}

export function PreviewLoja({ config }: PreviewLojaProps) {
  const taxa =
    config.taxa_entrega != null && !Number.isNaN(Number(config.taxa_entrega))
      ? `R$ ${Number(config.taxa_entrega).toFixed(2).replace(".", ",")}`
      : "Grátis";
  const minimo =
    config.pedido_minimo != null && !Number.isNaN(Number(config.pedido_minimo))
      ? `R$ ${Number(config.pedido_minimo).toFixed(2).replace(".", ",")}`
      : null;

  return (
    <div>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#C8285F] to-[#E33E70] px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Preview da Loja</h3>
            <span className="text-[11px] text-white/80 bg-white/15 px-2 py-0.5 rounded-full">
              Ao vivo
            </span>
          </div>
        </div>

        {/* Mockup Mobile */}
        <div className="p-4 bg-[#F8F9FC]">
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-[#E5E7EB]">
            {/* Banner */}
            {config.banner_url ? (
              <div className="relative w-full h-32">
                <Image
                  sizes="(max-width: 767px) calc(100vw - 80px), 400px"
                  src={config.banner_url}
                  alt="Banner"
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-[#C8285F] to-[#E33E70]" />
            )}

            {/* Logo & Info */}
            <div className="p-4 relative">
              {/* Logo */}
              {config.logo_url ? (
                <div className="absolute -top-10 left-4 w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
                  <Image
                    sizes="80px"
                    src={config.logo_url}
                    alt="Logo"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="absolute -top-10 left-4 w-20 h-20 rounded-full border-4 border-white bg-gradient-to-br from-[#C8285F] to-[#E33E70] flex items-center justify-center shadow-lg">
                  <Store className="w-10 h-10 text-white" />
                </div>
              )}

              {/* Status Badge */}
              <div className="flex justify-end mb-2">
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    config.esta_aberto
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {config.esta_aberto ? "🟢 Aberto Agora" : "🔴 Fechado"}
                </span>
              </div>

              {/* Nome e Descrição */}
              <div className="mt-4">
                <h2 className="text-xl font-bold text-[#111827] mb-1">
                  {config.nome || "Nome da Loja"}
                </h2>
                {config.descricao && (
                  <p className="text-sm text-[#6B7280] mb-3 line-clamp-2">
                    {config.descricao}
                  </p>
                )}

                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {/* Horário */}
                  {config.horario_abertura && config.horario_fechamento && (
                    <div className="bg-[#F8F9FC] rounded-lg p-2 border border-[#E5E7EB]">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#C8285F]" />
                        <span className="text-xs font-medium text-[#6B7280]">
                          Horário
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {config.horario_abertura} - {config.horario_fechamento}
                      </p>
                    </div>
                  )}

                  {/* Entrega */}
                  {config.tempo_entrega_min && config.tempo_entrega_max && (
                    <div className="bg-[#F8F9FC] rounded-lg p-2 border border-[#E5E7EB]">
                      <div className="flex items-center gap-2 mb-1">
                        <Truck className="w-3.5 h-3.5 text-[#C8285F]" />
                        <span className="text-xs font-medium text-[#6B7280]">
                          Entrega
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {config.tempo_entrega_min}-{config.tempo_entrega_max} min
                      </p>
                    </div>
                  )}

                  {/* Taxa */}
                  <div className="bg-[#F8F9FC] rounded-lg p-2 border border-[#E5E7EB]">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-3.5 h-3.5 text-[#C8285F]" />
                      <span className="text-xs font-medium text-[#6B7280]">
                        Taxa
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#111827]">{taxa}</p>
                  </div>

                  {/* Pedido Mínimo */}
                  {minimo && (
                    <div className="bg-[#F8F9FC] rounded-lg p-2 border border-[#E5E7EB]">
                      <div className="flex items-center gap-2 mb-1">
                        <Store className="w-3.5 h-3.5 text-[#C8285F]" />
                        <span className="text-xs font-medium text-[#6B7280]">
                          Mínimo
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {minimo}
                      </p>
                    </div>
                  )}
                </div>

                {/* Endereço */}
                {(config.endereco || config.cidade) && (
                  <div className="flex items-start gap-2 text-xs text-[#6B7280] mb-3">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      {config.endereco && `${config.endereco}, `}
                      {config.cidade && `${config.cidade}`}
                      {config.estado && `/${config.estado}`}
                    </span>
                  </div>
                )}

                {/* Telefone */}
                {config.telefone && (
                  <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-4">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{config.telefone}</span>
                  </div>
                )}

                {/* CTA Button */}
                <Button
                  className="w-full bg-[#C8285F] hover:bg-[#E33E70] h-11 text-sm font-semibold"
                  disabled={!config.esta_aberto}
                >
                  {config.esta_aberto ? "Ver Cardápio" : "Loja Fechada"}
                </Button>
              </div>
            </div>
          </div>

          {/* Info Extra */}
          <div className="mt-4 text-center">
            <p className="text-xs text-[#6B7280]">
              Preview atualizado em tempo real
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
