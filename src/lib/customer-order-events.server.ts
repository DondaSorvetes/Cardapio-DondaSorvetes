import "server-only";
import { NextResponse } from "next/server";
import type {
  OrderEventHub,
  OrderChange,
} from "@/lib/customer-order-hub.server";
/** Each SSE owns a subscriber, never the shared Supabase connection. */
/**
 * Stream lifetime before a clean "rotate". Must stay below the route's
 * maxDuration (300s on Vercel Fluid compute) so the platform never cuts the
 * stream mid-flight; the client resumes from Last-Event-ID without refetching.
 */
export const ORDER_STREAM_LIFETIME_MS = 280_000;

export function customerOrderEvents(
  hub: OrderEventHub,
  owner: string,
  previousVersion: string,
  signal: AbortSignal,
) {
  const encoder = new TextEncoder();
  let finish = () => {};
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let stopped = false,
        initializing = false,
        initialized = false,
        revisionSeen = previousVersion;
      let pending: OrderChange | undefined;
      let unsubscribe = () => {};
      let heartbeat: ReturnType<typeof setInterval> | undefined = undefined,
        lifetime: ReturnType<typeof setTimeout> | undefined = undefined;
      const debug = (reason: string) => {
        if (process.env.NODE_ENV !== "production")
          console.debug("[order-sse]", { owner, reason, ...hub.stats() });
      };
      const send = (event: string, data: unknown, id?: string) => {
        if (!stopped)
          controller.enqueue(
            encoder.encode(
              (id ? "id: " + id + "\n" : "") +
                "event: " +
                event +
                "\ndata: " +
                JSON.stringify(data) +
                "\n\n",
            ),
          );
      };
      finish = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        signal.removeEventListener("abort", finish);
        unsubscribe();
        if (!cancelled) controller.close();
        debug("close");
      };
      const change = (event: OrderChange) => {
        if (stopped) return;
        if (!initialized) {
          pending = {
            ...event,
            ids: [...new Set([...(pending?.ids ?? []), ...event.ids])],
          };
          return;
        }
        if (event.version === revisionSeen) return;
        revisionSeen = event.version;
        send("changed", { scope: "pedido", ids: event.ids }, event.version);
      };
      controller.enqueue(encoder.encode("retry: 1000\n\n"));
      unsubscribe = hub.subscribe(owner, {
        ready: () => {
          if (stopped || initialized || initializing) return;
          initializing = true;
          void hub
            .revision(owner)
            .then((version) => {
              if (stopped) return;
              const catchup =
                previousVersion && previousVersion.split("-")[0] !== version;
              revisionSeen = version;
              if (catchup)
                send("changed", { scope: "pedido", catchup: true }, version);
              if (pending && !catchup) {
                const event = pending;
                revisionSeen = event.version;
                send(
                  "changed",
                  { scope: "pedido", ids: event.ids },
                  event.version,
                );
              }
              pending = undefined;
              initialized = true;
              send("ready", { owner }, revisionSeen);
              debug("ready");
            })
            .catch(() => {
              if (!stopped) {
                send("unavailable", {});
                finish();
              }
            });
        },
        changed: change,
        unavailable: () => {
          if (!stopped) {
            send("unavailable", {});
            finish();
          }
        },
      });
      heartbeat = setInterval(() => {
        if (!stopped) controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15_000);
      lifetime = setTimeout(() => {
        send("rotate", {});
        debug("rotate");
        finish();
      }, ORDER_STREAM_LIFETIME_MS);
      signal.addEventListener("abort", finish, { once: true });
      if (signal.aborted) finish();
      debug("open");
    },
    cancel() {
      cancelled = true;
      finish();
    },
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Customer-Id": owner,
    },
  });
}
