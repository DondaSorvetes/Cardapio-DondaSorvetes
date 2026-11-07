"use client";
import { mfaQrImageSource } from "@/lib/security/mfa-qr";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listAdminMfa,
  enrollAdminMfa,
  verifyAdminMfa,
  unenrollAdminMfa,
} from "@/actions/admin/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Factor = { id: string; friendly_name?: string };
type Enrollment = { id: string; qr: string; secret: string };
export function AdminMfaSettings() {
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setFactors(await listAdminMfa());
    } catch {
      setError(
        "Não foi possível consultar a segurança da sua conta. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch {
      setError(
        "Não foi possível concluir. Confira o código e a conexão e tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const start = () =>
    run(async () => {
      try {
        setEnrollment(await enrollAdminMfa());
        setCode("");
      } catch {
        setError(
          "Não foi possível iniciar o 2FA. Tente novamente ou confira se TOTP está habilitado nas configurações de autenticação do Supabase.",
        );
      }
    });
  const verify = () =>
    run(async () => {
      const id = enrollment?.id || removeId;
      if (!id) return;
      if (removeId) {
        await unenrollAdminMfa(removeId, code);
        toast.success("Autenticador desativado");
      } else {
        const result = await verifyAdminMfa(id, code);
        if (!result.success) {
          setError(
            "Código inválido ou expirado. Digite o código atual do aplicativo.",
          );
          return;
        }
        toast.success("Autenticação em duas etapas ativada");
      }
      setEnrollment(null);
      setRemoveId(null);
      setCode("");
      await load();
      router.refresh();
    });
  const cancel = () =>
    run(async () => {
      if (enrollment) {
        await unenrollAdminMfa(enrollment.id);
      }
      setEnrollment(null);
      setRemoveId(null);
      setCode("");
    });
  return (
    <section className="max-w-xl" aria-labelledby="admin-security-title">
      <h2
        id="admin-security-title"
        className="mb-2 text-lg font-semibold text-foreground"
      >
        Segurança da sua conta
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        Adicione uma segunda verificação ao seu login. A ativação é opcional e
        vale somente para a sua conta.
      </p>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">
            Autenticação em duas etapas
          </h3>
          {!loading && !error && (
            <span className="text-xs font-medium text-primary">
              {factors.length ? "Ativada" : "Desativada"}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Use um aplicativo autenticador, como Google Authenticator, Microsoft
          Authenticator ou Authy. Depois de ativar, será necessário informar um
          código ao entrar.
        </p>
        {loading && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Consultando sua conta…
          </p>
        )}
        {enrollment && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <p className="text-sm">
              1. No aplicativo autenticador, adicione uma conta e escaneie o QR
              code.
            </p>
            <Image
              src={mfaQrImageSource(enrollment.qr)}
              alt="QR code para cadastrar o autenticador da sua conta"
              width={200}
              height={200}
              unoptimized
              className="max-w-full bg-white"
            />
            <details className="text-sm">
              <summary className="cursor-pointer text-primary">
                Não consegue escanear?
              </summary>
              <p className="mt-2 text-muted-foreground">
                Cadastre a conta manualmente com esta chave. Guarde-a em um
                local seguro e não compartilhe.
              </p>
              <code className="mt-2 block break-all rounded-md bg-muted p-3 text-sm">
                {enrollment.secret}
              </code>
            </details>
            <p className="text-sm">
              2. Digite o código exibido no aplicativo para concluir a ativação.
            </p>
          </div>
        )}
        {removeId && (
          <p className="mt-5 text-sm">
            Para desativar este autenticador, confirme com o código atual. Ele
            deixará de ser solicitado se não houver outro autenticador ativo.
          </p>
        )}
        {(enrollment || removeId) && (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void verify();
            }}
          >
            <div className="max-w-[220px] space-y-1.5">
              <Label htmlFor="security-totp">Código de seis dígitos</Label>
              <Input
                id="security-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
                disabled={busy}
                className="h-11 text-base tracking-[.3em]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy
                  ? "Verificando…"
                  : removeId
                    ? "Confirmar desativação"
                    : "Confirmar e ativar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void cancel()}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {!loading && !enrollment && !removeId && factors.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {factors.map((factor) => (
              <li
                key={factor.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <span className="text-sm">
                  {factor.friendly_name || "Aplicativo autenticador"}
                </span>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setRemoveId(factor.id);
                    setCode("");
                    setError("");
                  }}
                >
                  Desativar
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && !factors.length && !enrollment && (
          <Button disabled={busy} onClick={() => void start()} className="mt-4">
            {busy ? "Preparando…" : "Ativar autenticação em duas etapas"}
          </Button>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {error && !enrollment && !removeId && (
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={busy}
            className="mt-3"
          >
            Tentar novamente
          </Button>
        )}
      </div>
    </section>
  );
}
