"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getAutomaticPrintOrders, prepareOrderForAutomaticPrint } from "@/actions/admin/automatic-print";
import { AUTOMATIC_PRINT_TYPE, PRINT_DEVICE_EVENT, PRINT_DEVICE_KEY, getSentOrders, markOrderSent, withPrintLock } from "@/lib/admin/automatic-print";
import type { Pedido } from "@/types/pedido";
import { OrderPrint } from "./OrderPrint";

export function AutomaticOrderPrint() {
  const [device, setDevice] = useState(false);
  const [ticket, setTicket] = useState<Pedido | null>(null);
  const [finishPrint, setFinishPrint] = useState<(() => void) | null>(null);

  useEffect(() => {
    const sync = () => { try { setDevice(localStorage.getItem(PRINT_DEVICE_KEY) === "1"); } catch { setDevice(false); } };
    sync();
    window.addEventListener(PRINT_DEVICE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(PRINT_DEVICE_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    if (!device) return;
    let ordersLive = false, configLive = false, lastCheckAt = 0, queued = false;
    let stopped = false, busy = false, since: string | null = null, enabledAt: string | null = null, warned = false;
    const check = async (force = false) => {
      if (busy && force) queued = true;
      if (stopped || busy || (!force && Date.now() - lastCheckAt < 10_000)) return;
      lastCheckAt = Date.now();
      busy = true;
      try {
        await withPrintLock(async () => {
          if (stopped) return;
          if (document.querySelector(".print-root")) return;
          const result = await getAutomaticPrintOrders(since);
          if (stopped) return;
          if (!result.enabled) { since = result.serverTime; enabledAt = result.serverTime; return; }
          enabledAt ??= result.serverTime;
          for (const order of result.orders) {
            if (stopped || Date.parse(order.created_at) < Date.parse(enabledAt) || getSentOrders()[order.id]) continue;
            const prepared = await prepareOrderForAutomaticPrint(order.id);
            if (stopped) return;
            if (!prepared) continue;
            await new Promise<void>(resolve => {
              setFinishPrint(() => resolve);
              setTicket(prepared);
            });
          }
          if (!stopped) since = result.serverTime;
          warned = false;
        });
      } catch (error) {
        if (!stopped && !warned) toast.error(error instanceof Error ? error.message : "Falha na impressão automática.", { description: "O painel tentará novamente. A impressão manual continua disponível." });
        warned = true;
      } finally { busy = false; if (queued && !stopped) { queued = false; void check(true); } }
    };
    const db = createClient();
    const channel = db.channel(`auto-print-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, () => { void check(true); })
      .subscribe(status => { const wasLive = ordersLive; ordersLive = status === "SUBSCRIBED"; if (ordersLive && !wasLive) void check(true); });
    const configChannel = db.channel("auto-print-config-" + crypto.randomUUID())
      .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes_loja" }, () => { void check(true); })
      .subscribe(status => { configLive = status === "SUBSCRIBED"; });
    void check();
    const timer = setInterval(() => { if (!ordersLive || !configLive) void check(); }, 10_000);
    const resume = () => { if (!ordersLive || !configLive) void check(); };
    window.addEventListener("focus", resume);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener("focus", resume); void db.removeChannel(channel); void db.removeChannel(configChannel); };
  }, [device]);

  useEffect(() => {
    if (!ticket || !finishPrint) return;
    if (!device) { setTicket(null); setFinishPrint(null); finishPrint(); return; }
    let completed = false, sent = false;
    const done = () => {
      if (completed) return;
      completed = true;
      setTicket(null);
      setFinishPrint(null);
      finishPrint();
    };
    const afterPrint = () => { if (sent) done(); };
    const printError = () => { toast.error("A impressora não aceitou o envio.", { description: "Confira o menu Impressora do aplicativo e reimprima o pedido pelo painel." }); done(); };
    window.addEventListener("afterprint", afterPrint);
    window.addEventListener("donda:print-error", printError);
    const timer = setTimeout(() => {
      try {
        // Record dispatch, not physical printing: the browser cannot distinguish cancel.
        // Reserve before opening the dialog; storage failure must not cause repeated physical prints.
        markOrderSent(ticket.id);
        sent = true;
        window.print();
      } catch {
        toast.error("Não foi possível abrir a impressão.", { description: "Use a impressão manual do pedido." });
        done();
      }
    }, 250);
    // Keep the ticket mounted while non-blocking browser print previews are open.
    const watchdog = setTimeout(() => {
      if (!completed) { toast.warning("A impressão não foi confirmada pelo navegador.", { description: "Confira a impressora e reimprima manualmente se necessário." }); done(); }
    }, 5 * 60_000);
    return () => { clearTimeout(timer); clearTimeout(watchdog); window.removeEventListener("afterprint", afterPrint); window.removeEventListener("donda:print-error", printError); if (!completed) finishPrint(); };
  }, [ticket, finishPrint, device]);

  return ticket ? createPortal(<OrderPrint pedido={ticket} tipo={AUTOMATIC_PRINT_TYPE} />, document.body) : null;
}
