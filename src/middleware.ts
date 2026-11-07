import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/imagem (public catalog images: own guard, rate limit and path
     *   sanitization; no session needed, so skip the Supabase Auth round trip
     *   and the general 120/min API bucket that would starve image loads)
     * - api/health (probes)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/imagem(?:/|$)|api/health$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
