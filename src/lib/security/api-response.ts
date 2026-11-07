import { NextResponse } from "next/server";

/**
 * Respostas de API padronizadas — nunca expõe stack, SQL ou secrets.
 */

export type ApiErrorBody = {
  erro: string;
  codigo?: string;
};

export function apiError(
  message: string,
  status: number,
  opts?: {
    codigo?: string;
    headers?: HeadersInit;
  }
) {
  const body: ApiErrorBody = {
    erro: message,
    ...(opts?.codigo ? { codigo: opts.codigo } : {}),
  };
  return NextResponse.json(body, {
    status,
    headers: opts?.headers,
  });
}

export function apiOk<T extends Record<string, unknown>>(
  data: T,
  status = 200,
  headers?: HeadersInit
) {
  return NextResponse.json(data, { status, headers });
}

export function apiRateLimited(headers?: HeadersInit) {
  return apiError("Muitas tentativas. Aguarde um momento e tente de novo.", 429, {
    codigo: "RATE_LIMIT",
    headers,
  });
}

export function apiUnauthorized(msg = "Não autenticado") {
  return apiError(msg, 401, { codigo: "UNAUTHORIZED" });
}

export function apiForbidden(msg = "Acesso não autorizado") {
  return apiError(msg, 403, { codigo: "FORBIDDEN" });
}

export function apiValidation(msg = "Dados inválidos") {
  return apiError(msg, 400, { codigo: "VALIDATION" });
}

export function apiServerError(logContext?: unknown) {
  if (logContext != null) {
    console.error("[api]", logContext);
  }
  return apiError("Erro interno do servidor", 500, { codigo: "INTERNAL" });
}

/** Aceita apenas os métodos HTTP listados */
export function assertMethod(
  request: Request,
  allowed: string[]
): NextResponse | null {
  if (!allowed.includes(request.method)) {
    return apiError("Método não permitido", 405, {
      codigo: "METHOD_NOT_ALLOWED",
      headers: { Allow: allowed.join(", ") },
    });
  }
  return null;
}
