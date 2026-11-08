import "server-only";
import { createHash } from "node:crypto";
import {
  createDedicatedServiceRoleClient,
  type createServiceRoleClient,
} from "@/integrations/supabase/client.server";
type DB = ReturnType<typeof createServiceRoleClient>;
export type OrderChange = { ids: string[]; version: string };
export type OrderSubscriber = {
  ready: () => void;
  changed: (change: OrderChange) => void;
  unavailable: () => void;
};
export function createOrderEventHub(createDB: () => DB) {
  const owners = new Map<string, Set<OrderSubscriber>>();
  const batches = new Map<
    string,
    {
      ids: Set<string>;
      timer?: ReturnType<typeof setTimeout>;
      running: boolean;
    }
  >();
  let db: DB | undefined, channel: ReturnType<DB["channel"]> | undefined;
  let live = false,
    starting = false,
    epoch = 0;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let removing: Promise<unknown> = Promise.resolve();
  const client = () => (db ??= createDB());
  const debug = (reason: string, owner?: string) => {
    if (process.env.NODE_ENV !== "production")
      console.debug("[order-hub]", {
        reason,
        owner,
        subscribers: [...owners.values()].reduce((n, s) => n + s.size, 0),
        ownerSubscribers: owner ? (owners.get(owner)?.size ?? 0) : undefined,
        channels: channel ? 1 : 0,
      });
  };
  const revision = async (owner: string) => {
    const { data, count, error } = await client()
      .from("pedidos")
      .select("id,status,updated_at", { count: "exact" })
      .eq("cliente_id", owner)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .limit(1);
    if (error) throw new Error("Não foi possível sincronizar os pedidos.");
    return createHash("sha256")
      .update(JSON.stringify([count, data]))
      .digest("hex");
  };
  const flush = async (owner: string) => {
    const batch = batches.get(owner);
    if (!batch || batch.running) return;
    batch.running = true;
    const ids = [...batch.ids];
    batch.ids.clear();
    try {
      const version = (await revision(owner)) + "-" + Date.now().toString(36);
      if (batches.get(owner) === batch)
        for (const subscriber of [...(owners.get(owner) ?? [])])
          subscriber.changed({ ids, version });
    } catch {
      for (const subscriber of [...(owners.get(owner) ?? [])])
        subscriber.unavailable();
    } finally {
      batch.running = false;
      if (batches.get(owner) === batch && batch.ids.size)
        batch.timer = setTimeout(() => void flush(owner), 100);
    }
  };
  const ensure = () => {
    if (channel || starting || !owners.size) return;
    starting = true;
    const generation = epoch;
    void removing
      .then(() => {
        starting = false;
        if (!owners.size || generation !== epoch) return;
        channel = client()
          .channel("customer-order-hub-" + crypto.randomUUID())
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pedidos" },
            (payload) => {
              // DELETE has no trustworthy owner without REPLICA IDENTITY FULL.
              // The next connection's count/revision catch-up detects removal
              // (normally within 50 seconds plus reconnect/snapshot latency).
              if (payload.eventType === "DELETE") return;
              const row = payload.new as { cliente_id?: unknown; id?: unknown };
              if (
                typeof row.cliente_id !== "string" ||
                typeof row.id !== "string" ||
                !owners.has(row.cliente_id)
              )
                return;
              const owner = row.cliente_id;
              let batch = batches.get(owner);
              if (!batch) {
                batch = { ids: new Set(), running: false };
                batches.set(owner, batch);
              }
              batch.ids.add(row.id);
              clearTimeout(batch.timer);
              if (!batch.running)
                batch.timer = setTimeout(() => void flush(owner), 100);
            },
          )
          .subscribe((status) => {
            if (generation !== epoch) return;
            live = status === "SUBSCRIBED";
            if (live)
              for (const subscribers of owners.values())
                for (const subscriber of [...subscribers]) subscriber.ready();
            else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status))
              for (const subscribers of [...owners.values()])
                for (const subscriber of [...subscribers])
                  subscriber.unavailable();
          });
        debug("channel-open");
      })
      .catch(() => {
        starting = false;
        for (const subscribers of [...owners.values()])
          for (const subscriber of [...subscribers]) subscriber.unavailable();
      });
  };
  return {
    revision,
    subscribe(owner: string, subscriber: OrderSubscriber) {
      clearTimeout(idle);
      let subscribers = owners.get(owner);
      if (!subscribers) {
        subscribers = new Set();
        owners.set(owner, subscribers);
      }
      subscribers.add(subscriber);
      debug("subscribe", owner);
      ensure();
      if (live)
        queueMicrotask(() => {
          if (owners.get(owner)?.has(subscriber)) subscriber.ready();
        });
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        subscribers.delete(subscriber);
        if (!subscribers.size) {
          owners.delete(owner);
          const batch = batches.get(owner);
          clearTimeout(batch?.timer);
          batches.delete(owner);
        }
        debug("unsubscribe", owner);
        if (!owners.size)
          idle = setTimeout(() => {
            if (owners.size) return;
            live = false;
            epoch++;
            const closing = channel;
            channel = undefined;
            if (closing)
              removing = client()
                .removeChannel(closing)
                .catch(() => {})
                .then(() => {
                  if (!owners.size) client().realtime.disconnect();
                });
            debug("idle-close");
          }, 30_000);
      };
    },
    stats: () => ({
      owners: owners.size,
      subscribers: [...owners.values()].reduce((n, s) => n + s.size, 0),
      channels: channel ? 1 : 0,
    }),
  };
}
export type OrderEventHub = ReturnType<typeof createOrderEventHub>;
const globalHub = globalThis as typeof globalThis & {
  __dondaOrderEventHubV1?: OrderEventHub;
};
export function getOrderEventHub() {
  return (globalHub.__dondaOrderEventHubV1 ??= createOrderEventHub(
    createDedicatedServiceRoleClient,
  ));
}
