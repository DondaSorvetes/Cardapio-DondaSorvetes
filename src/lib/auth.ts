import {
  isRevoked,
  revokeSession,
  revocationEnabled,
} from "@/lib/security/session-revocation";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createServerClient } from "@/integrations/supabase/client.server";
import type { Endereco } from "@/types/endereco";

function getJwtSecret(): Uint8Array {
  const raw = process.env.AUTH_JWT_SECRET;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_JWT_SECRET deve ter no mínimo 32 caracteres em produção",
      );
    }
    // Dev only fallback — nunca usar em produção
    console.warn(
      "[security] AUTH_JWT_SECRET fraco/ausente — use um secret forte no .env",
    );
    return new TextEncoder().encode(
      raw || "dev-only-donda-jwt-secret-min-32-chars!!",
    );
  }
  return new TextEncoder().encode(raw);
}

export interface ClientePayload {
  id: string;
  nome: string | null;
  telefone: string | null;
  endereco: string | null;
  enderecos_adicionais?: Endereco[];
}

/**
 * Gera um token JWT para o cliente (sessão httpOnly cookie).
 */
export async function gerarToken(cliente: ClientePayload): Promise<string> {
  const secret = getJwtSecret();
  const token = await new SignJWT({
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    endereco: cliente.endereco,
    enderecos_adicionais: cliente.enderecos_adicionais || [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 dias (renovável no login)
    .setJti(crypto.randomUUID())
    .sign(secret);

  return token;
}

/**
 * Verifica e decodifica um token JWT
 */
export async function verificarToken(
  token: string,
): Promise<ClientePayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    if (!payload.id || typeof payload.id !== "string") return null;
    if (
      revocationEnabled() &&
      (!payload.jti || (await isRevoked(createServerClient(), payload.jti)))
    )
      return null;
    return payload as unknown as ClientePayload;
  } catch {
    return null;
  }
}

/**
 * Obtém a sessão do cliente autenticado através do cookie
 */
export async function obterSessao(): Promise<ClientePayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  return verificarToken(token);
}

/** Opções padrão de cookie de sessão (cliente Sorvetes Donda) */
export function sessionCookieOptions(maxAgeSec = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeSec,
    path: "/",
  };
}

/**
 * Normaliza telefone removendo caracteres não numéricos
 */
export function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "").slice(0, 15);
}

/**
 * Busca cliente no banco de dados pelo telefone
 */
export async function buscarClientePorTelefone(telefone: string) {
  const supabase = createServerClient();
  const telefoneNormalizado = normalizarTelefone(telefone);

  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("telefone", telefoneNormalizado)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar cliente");
    return null;
  }

  return data;
}

/** Optional database-backed invalidation; enable only after its migration. */
export async function revogarToken(token: string): Promise<void> {
  if (!revocationEnabled()) return;
  let payload;
  try {
    payload = (
      await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] })
    ).payload;
  } catch {
    return;
  }
  if (payload.jti && typeof payload.exp === "number")
    await revokeSession(createServerClient(), payload.jti, payload.exp);
}
