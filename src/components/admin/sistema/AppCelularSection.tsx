"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useInstallState } from "@/components/admin/pwa/AdminPwa";
import { promptInstall } from "@/lib/pwa/install";


function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm text-[#374151]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FDF0F4] text-xs font-semibold text-[#C8285F]">
            {index + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

const androidSteps = (adminUrl: string) => [
  <>Abra <strong>{adminUrl}</strong> no Chrome do celular e entre no painel.</>,
  <>Toque no menu <strong>⋮</strong> no canto de cima.</>,
  <>Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>) e confirme.</>,
];

const iosSteps = (adminUrl: string) => [
  <>Abra <strong>{adminUrl}</strong> no <strong>Safari</strong> do iPhone.</>,
  <>Toque no botão <strong>Compartilhar</strong> (o quadrado com a seta para cima).</>,
  <>Role e toque em <strong>Adicionar à Tela de Início</strong>, depois em <strong>Adicionar</strong>.</>,
  <>Abra o app pelo ícone <strong>Sorvetes Donda</strong> e entre com seu e-mail e senha uma vez.</>,
];

export function AppCelularSection() {
  const state = useInstallState();
  const [message, setMessage] = useState("");
  // Endereço que o admin está usando agora (sem domínio fixo no código).
  const [adminUrl, setAdminUrl] = useState("o endereço do painel");
  useEffect(() => setAdminUrl(`${window.location.host}/admin`), []);

  const install = async () => {
    setMessage("");
    const accepted = await promptInstall().catch(() => false);
    setMessage(accepted ? "Pronto! O ícone Sorvetes Donda foi adicionado ao celular." : "Instalação cancelada.");
  };

  const inApp = state.standalone || state.installed;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-lg font-semibold text-[#111827]">App no celular</h2>
        <p className="text-sm text-[#6B7280]">
          Instale o painel no celular para abrir pelo ícone, em tela cheia, sem precisar entrar no navegador. Funciona
          em Android e iPhone, não passa por loja e se atualiza sozinho a cada publicação.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático do app */}
            <img src="/pwa/admin-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-[#111827]">Donda Admin</p>
              <p className="text-sm text-[#6B7280]">
                {inApp
                  ? "Você está usando o app instalado."
                  : state.platform === "desktop"
                    ? "Abra esta página no celular para instalar."
                    : "Ainda não instalado neste celular."}
              </p>
            </div>
          </div>
          {!inApp && state.canPrompt && (
            <Button type="button" onClick={() => void install()} className="h-10 bg-[#C8285F] px-5 hover:bg-[#A51F50]">
              Instalar app
            </Button>
          )}
          {inApp && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Instalado</span>
          )}
        </div>
        {message && <p className="border-t border-[#F3F4F6] px-4 py-3 text-sm text-[#374151] sm:px-5">{message}</p>}
      </div>

      {!inApp && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* O sistema da pessoa aparece primeiro. */}
          <section aria-labelledby="pwa-ios" className={state.platform === "android" ? "order-2" : undefined}>
            <h3 id="pwa-ios" className="mb-2 text-sm font-semibold text-[#111827]">
              iPhone
            </h3>
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
              <Steps items={iosSteps(adminUrl)} />
            </div>
          </section>
          <section aria-labelledby="pwa-android">
            <h3 id="pwa-android" className="mb-2 text-sm font-semibold text-[#111827]">
              Android
            </h3>
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
              <Steps
                items={
                  state.platform === "android" && state.canPrompt
                    ? [<>Toque em <strong>Instalar app</strong> acima e confirme.</>]
                    : androidSteps(adminUrl)
                }
              />
            </div>
          </section>
        </div>
      )}

      <div className="space-y-1 text-xs text-[#6B7280]">
        <p>
          O app usa o mesmo login do painel, com a verificação em duas etapas. No iPhone, o app instalado tem login
          separado do Safari: entre uma vez dentro do app.
        </p>
        <p>Sem internet, o app mostra um aviso em vez de dados antigos: nada do painel fica guardado no celular.</p>
      </div>
    </div>
  );
}
