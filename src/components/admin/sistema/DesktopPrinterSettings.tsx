"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type PrinterState = { selected: string; printers: { name: string; label: string; isDefault: boolean }[] };
type DesktopBridge = {
  getPrinters?: () => Promise<PrinterState>;
  selectPrinter: (name: string) => Promise<void>;
  openWindowsPrinters: () => Promise<void>;
};
const bridge = () => (window as Window & { dondaDesktop?: DesktopBridge }).dondaDesktop;

export function DesktopPrinterSettings() {
  const [state, setState] = useState<PrinterState>({ selected: "", printers: [] });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const api = bridge();
      if (!api?.getPrinters) throw Error("Instale a versão 1.1.0 ou mais recente do aplicativo para configurar a impressora aqui.");
      setState(await api.getPrinters());
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar as impressoras."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const missing = state.selected && !state.printers.some(p => p.name === state.selected);
  return (
    <section className="mt-5 space-y-3 rounded-md border border-[#E5E7EB] bg-white p-4 sm:p-6" aria-labelledby="desktop-printer-title" aria-busy={busy}>
      <h3 id="desktop-printer-title" className="font-semibold text-[#111827]">Impressora deste computador</h3>
      <label htmlFor="desktop-printer" className="block text-sm text-[#374151]">Impressora para os dois cupons</label>
      <select id="desktop-printer" value={state.selected} disabled={busy || !bridge()?.getPrinters}
        className="min-h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]"
        onChange={async event => {
          const name = event.target.value;
          setBusy(true); setError(""); setMessage("");
          try { await bridge()!.selectPrinter(name); setState(current => ({ ...current, selected: name })); setMessage("Impressora salva neste computador."); }
          catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a impressora."); }
          finally { setBusy(false); }
        }}>
        <option value="">Usar impressora padrão do Windows</option>
        {missing && <option value={state.selected}>{state.selected} (indisponível)</option>}
        {state.printers.map(p => <option key={p.name} value={p.name}>{p.label}{p.isDefault ? " (padrão do Windows)" : ""}</option>)}
      </select>
      {!busy && !state.printers.length && <p className="text-sm text-[#6B7280]">Nenhuma impressora física encontrada. Instale ou conecte a impressora no Windows e atualize a lista.</p>}
      {missing && <p role="alert" className="text-sm text-red-700">A impressora salva está indisponível. Conecte-a ou escolha outra.</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => { setMessage(""); void refresh(); }}>Atualizar impressoras</Button>
        <Button variant="outline" disabled={!bridge()?.getPrinters} onClick={async () => {
          try { await bridge()!.openWindowsPrinters(); }
          catch { setError("Não foi possível abrir as configurações do Windows."); }
        }}>Abrir impressoras do Windows</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p role="status" className="text-sm text-[#C8285F]">{message}</p>
      <p className="text-sm leading-relaxed text-[#6B7280]">Os cupons da cozinha e do cliente são enviados sem confirmação. Mantenha as duas opções acima ativadas e o aplicativo aberto ou minimizado, com internet. Configure papel e orientação nas preferências da impressora no Windows.</p>
    </section>
  );
}
