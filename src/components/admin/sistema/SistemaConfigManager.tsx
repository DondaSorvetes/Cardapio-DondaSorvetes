"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updatePreferenciasEstabelecimento,
  reiniciarNumeracaoPedidos,
} from "@/actions/admin/estabelecimento-settings";
import {
  SOM_ALERTA_OPCOES,
  type PreferenciasEstabelecimento,
  type SomAlertaTipo,
} from "@/types/estabelecimento-settings";
import {
  applySoundPreferences,
  playNewOrderSound,
  unlockPedidosAudio,
} from "@/lib/admin/order-alert-sound";
import { cn } from "@/lib/utils";
import { PRINT_DEVICE_EVENT, PRINT_DEVICE_KEY, setPrintDevice } from "@/lib/admin/automatic-print";
import { DesktopPrinterSettings } from "./DesktopPrinterSettings";
import { AtualizacoesSection } from "./AtualizacoesSection";
import { BackupSection } from "./BackupSection";
import { AppCelularSection } from "./AppCelularSection";
import { EntregadoresSection } from "./EntregadoresSection";
import { AdminMfaSettings } from "./AdminMfaSettings";
import { UsuariosSection } from "./UsuariosSection";

/* ─── Nav ─────────────────────────────────────────────────────────────── */

const SECTIONS = [
  { id: "pedidos", label: "Pedidos" },
  { id: "notificacoes", label: "Notificações" },
  { id: "impressao", label: "Impressão" },
  { id: "geral", label: "Geral" },
  { id: "seguranca", label: "Segurança" },
  { id: "usuarios", label: "Usuários" },
  { id: "entregadores", label: "Entregadores" },
  { id: "integracoes", label: "Integrações" },
  { id: "api", label: "API" },
  { id: "backup", label: "Backup" },
  { id: "atualizacoes", label: "Atualizações" },
  { id: "app", label: "App no celular" },
  { id: "assinatura", label: "Assinatura" },
  { id: "conta", label: "Conta" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/* ─── Preferências locais do painel (tema/idioma) ─────────────────────── */

type ThemePref = "system" | "light" | "dark";
type LangPref = "pt-BR" | "en";

type SistemaPrefs = {
  tema: ThemePref;
  idioma: LangPref;
  animacoes: boolean;
  densidade_compacta: boolean;
};

const SISTEMA_KEY = "donda-sistema-prefs";
const DEFAULT_SISTEMA: SistemaPrefs = {
  tema: "system",
  idioma: "pt-BR",
  animacoes: true,
  densidade_compacta: false,
};

function loadSistema(): SistemaPrefs {
  if (typeof window === "undefined") return DEFAULT_SISTEMA;
  try {
    const raw = localStorage.getItem(SISTEMA_KEY);
    if (!raw) return DEFAULT_SISTEMA;
    return { ...DEFAULT_SISTEMA, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SISTEMA;
  }
}

/* ─── UI primitives (só o necessário) ─────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-lg font-semibold text-[#111827]">{children}</h2>
  );
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm text-[#6B7280]">{children}</p>;
}

/** Bloco branco com borda fina — estilo GitHub/Stripe settings */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-[#E5E7EB] bg-white",
        className
      )}
    >
      {children}
    </div>
  );
}

function Row({
  title,
  description,
  children,
  last,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "admin-settings-row px-4 sm:px-6 py-4 min-h-[64px]",
        !last && "border-b border-[#E5E7EB]"
      )}
    >
      <div className="min-w-0">
        <p className="text-[17px] font-semibold leading-snug text-[#111827]">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="admin-settings-value">{children}</div>
    </div>
  );
}

function CompactSwitch({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className={cn(
        "h-5 w-9 shrink-0",
        "data-[state=checked]:bg-[#111827] data-[state=unchecked]:bg-[#D1D5DB]",
        "[&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
      )}
    />
  );
}

function EmptySection({ title }: { title: string }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <div className="px-5 sm:px-6 py-6 text-sm text-[#6B7280]">
          Esta seção estará disponível em breve.
        </div>
      </Panel>
    </div>
  );
}

/* ─── Manager ─────────────────────────────────────────────────────────── */

interface SistemaConfigManagerProps {
  preferenciasIniciais: PreferenciasEstabelecimento;
}

/** Baixa o configurador de impressão já apontando para o endereço deste painel. */
async function baixarConfigurador(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  try {
    const response = await fetch("/Donda-Impressao.cmd", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const script = (await response.text()).replace("__DONDA_ADMIN_URL__", window.location.origin + "/admin/pedidos");
    const url = URL.createObjectURL(new Blob([script], { type: "application/octet-stream" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Donda-Impressao.cmd";
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Não foi possível baixar o configurador. Tente novamente.");
  }
}

export function SistemaConfigManager({
  preferenciasIniciais,
}: SistemaConfigManagerProps) {
  const [section, setSection] = useState<SectionId>("pedidos");
  const [prefs, setPrefs] = useState(preferenciasIniciais);
  const [sistema, setSistema] = useState<SistemaPrefs>(DEFAULT_SISTEMA);
  const [saving, setSaving] = useState(false);
  const [printHere, setPrintHere] = useState(false);
  const [desktopApp, setDesktopApp] = useState(false);
  useEffect(() => {
    setDesktopApp(Boolean((window as Window & { dondaDesktop?: { version?: string } }).dondaDesktop?.version));
    const sync = () => { try { setPrintHere(localStorage.getItem(PRINT_DEVICE_KEY) === "1"); } catch { setPrintHere(false); } };
    sync();
    window.addEventListener(PRINT_DEVICE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(PRINT_DEVICE_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    setSistema(loadSistema());
    // Link direto para uma seção, ex.: /admin/configuracoes#app (convite de instalação).
    const hash = window.location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === hash)) setSection(hash as SectionId);
  }, []);

  useEffect(() => {
    applySoundPreferences({
      som_alerta_ativo: prefs.som_alerta_ativo,
      som_alerta_tipo: prefs.som_alerta_tipo,
      som_alerta_volume: prefs.som_alerta_volume,
    });
  }, [
    prefs.som_alerta_ativo,
    prefs.som_alerta_tipo,
    prefs.som_alerta_volume,
  ]);

  const persistOps = useCallback(
    async (patch: Partial<PreferenciasEstabelecimento>) => {
      setSaving(true);
      try {
        const updated = await updatePreferenciasEstabelecimento(patch);
        setPrefs((prev) => ({ ...prev, ...updated }));
        applySoundPreferences({
          som_alerta_ativo: updated.som_alerta_ativo,
          som_alerta_tipo: updated.som_alerta_tipo,
          som_alerta_volume: updated.som_alerta_volume,
        });
        window.dispatchEvent(new Event(PRINT_DEVICE_EVENT));
        toast.success("Alterações salvas.");
        return updated;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const toggle = useCallback(
    (key: keyof PreferenciasEstabelecimento, value: boolean) => {
      setPrefs((prev) => ({ ...prev, [key]: value }));
      void persistOps({ [key]: value } as Partial<PreferenciasEstabelecimento>);
    },
    [persistOps]
  );

  const saveSistema = useCallback((next: SistemaPrefs) => {
    setSistema(next);
    try {
      localStorage.setItem(SISTEMA_KEY, JSON.stringify(next));
      toast.success("Alterações salvas.");
    } catch {
      toast.error("Não foi possível salvar.");
    }
  }, []);

  const handleTestSound = async () => {
    await unlockPedidosAudio();
    await playNewOrderSound({
      force: true,
      type: prefs.som_alerta_tipo,
      volume: prefs.som_alerta_volume,
    });
  };

  const handleResetNumeracao = async () => {
    if (
      !window.confirm(
        "Reiniciar a numeração dos pedidos para 1? Pedidos existentes não serão alterados."
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const updated = await reiniciarNumeracaoPedidos(1);
      setPrefs((prev) => ({ ...prev, ...updated }));
      toast.success("Alterações salvas.");
    } catch {
      toast.error("Não foi possível reiniciar a numeração.");
    } finally {
      setSaving(false);
    }
  };

  const autoAccept =
    prefs.imprimir_aceitar_automaticamente ||
    prefs.aceitar_pedidos_automaticamente;

  return (
    <div className="min-h-full bg-[#F9FAFB]">
      <div className="flex flex-col md:flex-row w-full gap-6 lg:gap-10 px-4 sm:px-6 lg:px-8 py-5">
        {/* Nav lateral simples */}
        <nav
          className="hidden w-52 shrink-0 md:block"
          aria-label="Seções de configuração"
        >
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => {
              const active = section === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={cn(
                      "w-full rounded px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-[#F3F4F6] font-medium text-[#111827]"
                        : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                    )}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-[#E5E7EB] pt-4">
            <Link
              href="/admin/estabelecimento"
              className="block px-3 py-2 text-sm text-[#6B7280] hover:text-[#111827]"
            >
              Dados da loja →
            </Link>
          </div>
        </nav>

        {/* Mobile: seletor de seção */}
        <div className="mb-3 w-full md:hidden">
          <Select
            value={section}
            onValueChange={(v) => setSection(v as SectionId)}
          >
            <SelectTrigger className="h-10 rounded-md border-[#E5E7EB] bg-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-sm">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Conteúdo — ocupa toda a largura restante */}
        <div className="admin-settings-content min-w-0 flex-1 pb-10">
          {section === "pedidos" && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Pedidos</SectionTitle>
                <SectionHint>
                  Automações e numeração dos pedidos no painel.
                </SectionHint>
                <Panel>
                  <Row
                    title="Finalizar pedidos automaticamente"
                    description="Pedidos em aberto há mais de 24 horas serão finalizados."
                  >
                    <CompactSwitch
                      checked={prefs.finalizar_pedidos_apos_24h}
                      disabled={saving}
                      onCheckedChange={(v) =>
                        toggle("finalizar_pedidos_apos_24h", v)
                      }
                      aria-label="Finalizar pedidos automaticamente"
                    />
                  </Row>
                  <Row
                    title="Finalizar pedidos agendados"
                    description="Pedidos agendados serão finalizados 3 dias após a data."
                  >
                    <CompactSwitch
                      checked={prefs.finalizar_agendados_apos_3_dias}
                      disabled={saving}
                      onCheckedChange={(v) =>
                        toggle("finalizar_agendados_apos_3_dias", v)
                      }
                      aria-label="Finalizar pedidos agendados"
                    />
                  </Row>
                  <Row
                    title="Aceitar pedidos automaticamente"
                    description="Novos pedidos entram em preparo sem ação manual."
                    last
                  >
                    <CompactSwitch
                      checked={autoAccept}
                      disabled={saving}
                      onCheckedChange={(v) => {
                        void persistOps({ aceitar_pedidos_automaticamente: v, ...(!v ? { imprimir_aceitar_automaticamente: false } : {}) });
                      }}
                      aria-label="Aceitar pedidos automaticamente"
                    />
                  </Row>
                </Panel>
              </div>

              <div>
                <SectionTitle>Numeração</SectionTitle>
                <Panel>
                  <Row
                    title="Próximo pedido"
                    description="Número sequencial do próximo pedido."
                    last
                  >
                    <div className="flex items-center gap-3">
                      <span className="min-w-[3rem] text-right text-[17px] font-semibold tabular-nums text-[#111827]">
                        {prefs.proximo_numero_pedido.toLocaleString("pt-BR")}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleResetNumeracao()}
                        className="h-9 rounded-md border-[#E5E7EB] px-3.5 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
                      >
                        Reiniciar
                      </Button>
                    </div>
                  </Row>
                </Panel>
              </div>
            </div>
          )}

          {section === "notificacoes" && (
            <div>
              <SectionTitle>Notificações</SectionTitle>
              <SectionHint>
                Alertas ao receber novos pedidos no painel.
              </SectionHint>
              <Panel>
                <Row
                  title="Notificação de novos pedidos"
                  description="Exibir aviso quando um pedido chegar."
                >
                  <CompactSwitch
                    checked={prefs.notificar_novos_pedidos}
                    disabled={saving}
                    onCheckedChange={(v) =>
                      toggle("notificar_novos_pedidos", v)
                    }
                    aria-label="Notificação de novos pedidos"
                  />
                </Row>
                <Row
                  title="Som de alerta"
                  description="Tocar som quando um pedido chegar."
                >
                  <CompactSwitch
                    checked={prefs.som_alerta_ativo}
                    disabled={saving}
                    onCheckedChange={(v) => {
                      setPrefs((prev) => ({ ...prev, som_alerta_ativo: v }));
                      applySoundPreferences({ som_alerta_ativo: v });
                      void persistOps({ som_alerta_ativo: v });
                    }}
                    aria-label="Som de alerta"
                  />
                </Row>
                <Row title="Som" description="Tipo de alerta sonoro.">
                  <Select
                    value={prefs.som_alerta_tipo}
                    disabled={!prefs.som_alerta_ativo || saving}
                    onValueChange={(v) => {
                      const tipo = v as SomAlertaTipo;
                      setPrefs((prev) => ({ ...prev, som_alerta_tipo: tipo }));
                      applySoundPreferences({ som_alerta_tipo: tipo });
                      void persistOps({ som_alerta_tipo: tipo });
                    }}
                  >
                    <SelectTrigger className="h-9 w-[160px] rounded-md border-[#E5E7EB] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOM_ALERTA_OPCOES.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-sm"
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>
                <Row title="Volume" description="Intensidade do alerta (0–100).">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={prefs.som_alerta_volume}
                      disabled={!prefs.som_alerta_ativo || saving}
                      onChange={(e) => {
                        const n = Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0)
                        );
                        setPrefs((prev) => ({
                          ...prev,
                          som_alerta_volume: n,
                        }));
                      }}
                      onBlur={() => {
                        applySoundPreferences({
                          som_alerta_volume: prefs.som_alerta_volume,
                        });
                        void persistOps({
                          som_alerta_volume: prefs.som_alerta_volume,
                        });
                      }}
                      className="h-9 w-20 rounded-md border-[#E5E7EB] text-center text-sm tabular-nums"
                    />
                    <span className="text-sm text-[#6B7280]">%</span>
                  </div>
                </Row>
                <Row title="Testar som" description="Reproduz o alerta atual." last>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!prefs.som_alerta_ativo}
                    onClick={() => void handleTestSound()}
                    className="h-9 rounded-md border-[#E5E7EB] px-3.5 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
                  >
                    Testar
                  </Button>
                </Row>
              </Panel>
            </div>
          )}

          {section === "impressao" && (
            <div>
              <SectionTitle>Impressão</SectionTitle>
              <SectionHint>
                Impressão dos cupons da cozinha e do cliente.
              </SectionHint>
              <Panel>
                <Row
                  title="Aceitar e imprimir novos pedidos"
                  description="Quando um pedido chegar, ele entra em preparo e imprime os dois cupons: cozinha e cliente."
                >
                  <CompactSwitch
                    checked={prefs.imprimir_aceitar_automaticamente}
                    disabled={saving}
                    onCheckedChange={(enabled) => {
                      void (async () => {
                        const updated = await persistOps({ imprimir_aceitar_automaticamente: enabled, ...(enabled ? { aceitar_pedidos_automaticamente: true } : {}) });
                        if (updated) {
                          try { setPrintDevice(enabled); } catch { toast.error("Não foi possível ativar a impressão neste navegador."); }
                        }
                      })();
                    }}
                    aria-label="Aceitar e imprimir novos pedidos"
                  />
                </Row>
                <Row title="Imprimir neste dispositivo" description="Ative no computador conectado à impressora e mantenha o painel aberto. Use apenas um computador para evitar cópias em impressoras diferentes." last>
                  <CompactSwitch checked={printHere} disabled={saving || !prefs.imprimir_aceitar_automaticamente} aria-label="Imprimir neste dispositivo"
                    onCheckedChange={enabled => { try { setPrintDevice(enabled); } catch { toast.error("Não foi possível salvar a preferência deste dispositivo."); } }} />
                </Row>
              </Panel>
              {desktopApp ? <DesktopPrinterSettings /> : <section className="mt-5 space-y-3 text-sm leading-relaxed text-[#6B7280]" aria-labelledby="silent-print-setup">
                <h3 id="silent-print-setup" className="font-semibold text-[#111827]">Imprimir sem confirmação</h3>
                <p>Configure uma vez no computador Windows conectado à impressora da loja:</p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Defina a impressora da loja como padrão nas configurações de Impressoras do Windows. Escolha papel e orientação no driver da impressora.</li>
                  <li>Baixe e execute o configurador abaixo. Ele cria o atalho “Donda - Impressão Automática” na área de trabalho, com um perfil separado do Chrome ou Brave.</li>
                  <li>Abra o novo atalho, faça login e ative as duas opções acima nesse navegador. Mantenha o painel aberto pelo atalho.</li>
                </ol>
                <a href="/Donda-Impressao.cmd" download="Donda-Impressao.cmd" onClick={baixarConfigurador} className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#F6BFD2] bg-white px-4 py-2 font-medium text-[#C8285F] hover:bg-[#FDF0F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F] focus-visible:ring-offset-2">Baixar configurador para Windows</a>
                <p>O atalho envia os dois cupons para a impressora padrão sem pedir confirmação. Fora dele, o navegador continua exibindo a janela de impressão. Para encerrar, feche o painel; para desfazer, remova o atalho.</p>
              </section>}
            </div>
          )}

          {section === "geral" && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Aparência</SectionTitle>
                <Panel>
                  <Row title="Tema" description="Aparência do painel.">
                    <Select
                      value={sistema.tema}
                      onValueChange={(v) =>
                        saveSistema({ ...sistema, tema: v as ThemePref })
                      }
                    >
                      <SelectTrigger className="h-9 w-[160px] rounded-md border-[#E5E7EB] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system" className="text-sm">
                          Sistema
                        </SelectItem>
                        <SelectItem value="light" className="text-sm">
                          Claro
                        </SelectItem>
                        <SelectItem value="dark" className="text-sm">
                          Escuro
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row
                    title="Animações"
                    description="Transições leves na interface."
                  >
                    <CompactSwitch
                      checked={sistema.animacoes}
                      onCheckedChange={(v) =>
                        saveSistema({ ...sistema, animacoes: v })
                      }
                      aria-label="Animações"
                    />
                  </Row>
                  <Row
                    title="Interface compacta"
                    description="Menos espaço entre elementos."
                    last
                  >
                    <CompactSwitch
                      checked={sistema.densidade_compacta}
                      onCheckedChange={(v) =>
                        saveSistema({ ...sistema, densidade_compacta: v })
                      }
                      aria-label="Interface compacta"
                    />
                  </Row>
                </Panel>
              </div>

              <div>
                <SectionTitle>Idioma</SectionTitle>
                <Panel>
                  <Row
                    title="Idioma da interface"
                    description="Textos do painel administrativo."
                    last
                  >
                    <Select
                      value={sistema.idioma}
                      onValueChange={(v) =>
                        saveSistema({ ...sistema, idioma: v as LangPref })
                      }
                    >
                      <SelectTrigger className="h-9 w-[200px] rounded-md border-[#E5E7EB] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR" className="text-sm">
                          Português (Brasil)
                        </SelectItem>
                        <SelectItem value="en" className="text-sm">
                          English
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                </Panel>
              </div>
            </div>
          )}

          {section === "seguranca" && <AdminMfaSettings />}
          {section === "usuarios" && <UsuariosSection />}
          {section === "entregadores" && <EntregadoresSection />}
          {section === "integracoes" && <EmptySection title="Integrações" />}
          {section === "api" && <EmptySection title="API" />}
          {section === "backup" && <BackupSection />}
          {section === "atualizacoes" && <AtualizacoesSection />}
          {section === "app" && <AppCelularSection />}
          {section === "assinatura" && <EmptySection title="Assinatura" />}

          {section === "conta" && (
            <div>
              <SectionTitle>Conta</SectionTitle>
              <Panel>
                <Row
                  title="Gestão de usuários"
                  description="Papéis e telas liberadas ficam em Usuários."
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-md text-sm"
                    onClick={() => setSection("usuarios")}
                  >
                    Abrir Usuários
                  </Button>
                </Row>
                <Row title="Área" description="Painel em uso." last>
                  <span className="text-sm text-[#6B7280]">Donda Admin</span>
                </Row>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
