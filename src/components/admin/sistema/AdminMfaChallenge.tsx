"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyAdminMfa, signOutMfaSession } from "@/actions/admin/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function AdminMfaChallenge({
  factors,
}: {
  factors: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [factorId, setFactorId] = useState(factors[0]?.id || "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <p className="mb-3 text-sm font-semibold text-primary">Sorvetes Donda</p>
        <h1 className="text-xl font-semibold">Verificação em duas etapas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Digite o código do seu aplicativo autenticador para entrar no painel.
        </p>
        {!factors.length ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Não foi possível localizar um autenticador compatível. Procure o
            responsável pela conta para recuperar seu acesso.
          </p>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError("");
              try {
                const result = await verifyAdminMfa(factorId, code);
                if (!result.success) {
                  setError(
                    "Código inválido ou expirado. Use o código atual do aplicativo.",
                  );
                  return;
                }
                router.replace("/admin");
                router.refresh();
              } catch {
                setError(
                  "Não foi possível verificar. Confira sua conexão ou aguarde um momento antes de tentar novamente.",
                );
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            {factors.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="mfa-factor">Autenticador</Label>
                <select
                  id="mfa-factor"
                  value={factorId}
                  onChange={(e) => setFactorId(e.target.value)}
                  className="h-11 w-full rounded-md border border-input px-3"
                >
                  {factors.map((factor) => (
                    <option key={factor.id} value={factor.id}>
                      {factor.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="mfa-code">Código de seis dígitos</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={busy}
                className="h-11 text-base tracking-[.3em]"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              className="min-h-11 w-full"
              disabled={busy || code.length !== 6}
            >
              {busy ? "Verificando…" : "Confirmar e entrar"}
            </Button>
          </form>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            try {
              await signOutMfaSession();
              router.replace("/admin/login");
              router.refresh();
            } catch {
              setError("Não foi possível sair. Tente novamente.");
            }
          }}
          className="mt-4 min-h-11 text-sm text-muted-foreground hover:text-primary"
        >
          Voltar ao login
        </button>
      </section>
    </main>
  );
}
