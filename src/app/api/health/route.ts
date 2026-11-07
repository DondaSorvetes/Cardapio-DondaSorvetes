import { NextResponse } from "next/server";

/**
 * Health check (sem dados sensíveis) — monitoramento / load balancer.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "donda",
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
