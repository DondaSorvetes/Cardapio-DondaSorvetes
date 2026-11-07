"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DesenvolvidoPor } from "@/components/cliente/perfil/MenuPerfil";
import "./auth.css";

type AuthError = {
  message: string;
  field?: "nome" | "telefone";
  register?: boolean;
};
export function formatAuthPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length > 11) return digits;
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const local = digits.slice(2),
    split = local.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? "-" + local.slice(split) : ""}`;
}
export function CustomerAuth({ mode }: { mode: "entrar" | "cadastrar" }) {
  const registering = mode === "cadastrar",
    router = useRouter();
  const [nome, setNome] = useState(""),
    [telefone, setTelefone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<AuthError | null>(null),
    [status, setStatus] = useState("");
  const phoneRef = useRef<HTMLInputElement>(null),
    nameRef = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  useEffect(() => {
    try {
      setTelefone(sessionStorage.getItem("donda-auth-phone") ?? "");
      if (mode === "entrar") {
        const message = sessionStorage.getItem("donda-auth-feedback");
        if (message) {
          setError({ message });
          sessionStorage.removeItem("donda-auth-feedback");
        }
      }
    } catch {}
  }, [mode]);
  const changePhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    setTelefone(digits);
    setError(null);
    try {
      sessionStorage.setItem("donda-auth-phone", digits);
    } catch {}
  };
  const showError = (next: AuthError) => {
    setError(next);
    setStatus("");
    if (next.field === "nome") nameRef.current?.focus();
    else phoneRef.current?.focus();
  };
  const signIn = async () =>
    fetch("/api/auth/entrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone }),
    });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current) return;
    setError(null);
    if (registering && (nome.trim().length < 3 || nome.trim().length > 120)) {
      showError({
        message: "Informe seu nome completo, com pelo menos 3 caracteres.",
        field: "nome",
      });
      return;
    }
    if (telefone.length < 10 || telefone.length > 15) {
      showError({
        message:
          "Informe um telefone válido com DDD, com pelo menos 10 dígitos.",
        field: "telefone",
      });
      return;
    }
    lock.current = true;
    setBusy(true);
    setStatus(registering ? "Criando sua conta…" : "Entrando…");
    try {
      if (registering) {
        const response = await fetch("/api/auth/registrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: nome.trim(), telefone }),
        });
        const result = await response.json();
        if (!response.ok && response.status !== 409) {
          showError({
            message:
              result.erro ||
              "Não foi possível criar sua conta. Tente novamente.",
          });
          return;
        }
        setStatus(
          response.status === 409
            ? "Telefone já cadastrado. Entrando na sua conta…"
            : "Conta criada. Entrando…",
        );
      }
      const response = await signIn();
      if (!response.ok) {
        const result = await response.json();
        if (registering) {
          try {
            sessionStorage.setItem(
              "donda-auth-feedback",
              "Não foi possível entrar automaticamente. Entre com seu telefone para continuar.",
            );
            if (sessionStorage.getItem("reopenCart") === "true") {
              sessionStorage.removeItem("reopenCart");
              sessionStorage.removeItem("cartStep");
            }
          } catch {}
          router.push("/entrar");
          return;
        }
        showError(
          result.codigo === "USER_NOT_FOUND" || result.deveCriarConta
            ? {
                message:
                  "Conta não encontrada. Por favor, cadastre-se primeiro.",
                field: "telefone",
                register: true,
              }
            : {
                message:
                  result.erro || "Não foi possível entrar. Tente novamente.",
                field: "telefone",
              },
        );
        return;
      }
      setStatus("Tudo certo! Abrindo o cardápio…");
      try {
        sessionStorage.removeItem("donda-auth-phone");
      } catch {}
      window.location.href = "/";
    } catch {
      showError({
        message:
          "Não foi possível continuar. Confira sua conexão e tente novamente.",
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="customer-auth" data-mode={mode}>
      <a className="auth-skip" href="#auth-form">
        Pular para o formulário
      </a>
      <Link
        href="/"
        className="auth-close"
        aria-label="Fechar e voltar ao cardápio"
      >
        <X size={22} aria-hidden="true" />
      </Link>
      <div className="auth-composition">
        <section className="auth-main" aria-labelledby="auth-title">
          <div className="auth-heading">
            <h1 id="auth-title">{registering ? "Crie sua conta" : "Entrar"}</h1>
          </div>
          <form
            id="auth-form"
            className="auth-form"
            onSubmit={submit}
            noValidate
            aria-busy={busy}
          >
            {registering && (
              <div className="auth-field">
                <label htmlFor="auth-name">Nome completo</label>
                <Input
                  ref={nameRef}
                  id="auth-name"
                  name="nome"
                  autoComplete="name"
                  autoCapitalize="words"
                  placeholder="Como podemos te chamar?"
                  value={nome}
                  onChange={(event) => {
                    setNome(event.target.value);
                    setError(null);
                  }}
                  maxLength={120}
                  required
                  disabled={busy}
                  aria-invalid={error?.field === "nome"}
                  aria-describedby={
                    error?.field === "nome" ? "auth-error" : undefined
                  }
                />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-phone">Celular</label>
              <Input
                ref={phoneRef}
                id="auth-phone"
                name="telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(DDD) 99999-9999"
                value={formatAuthPhone(telefone)}
                onChange={(event) => changePhone(event.target.value)}
                required
                disabled={busy}
                aria-invalid={Boolean(error) && error?.field !== "nome"}
                aria-describedby={
                  error && error.field !== "nome"
                    ? "auth-phone-help auth-error"
                    : "auth-phone-help"
                }
              />
              <p id="auth-phone-help" className="sr-only">
                Informe o número com DDD.
              </p>
            </div>
            {error && (
              <div id="auth-error" className="auth-error" role="alert">
                <p>{error.message}</p>
                {error.register && (
                  <Link href="/cadastrar">Criar minha conta</Link>
                )}
              </div>
            )}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy && <Loader2 size={16} aria-hidden="true" />}
              {busy
                ? registering
                  ? "Criando conta…"
                  : "Entrando…"
                : registering
                  ? "Criar minha conta"
                  : "Continuar"}
            </button>
            <p className="auth-status" role="status" aria-live="polite">
              {status}
            </p>
          </form>
          {!error?.register && (
            <nav className="auth-switch" aria-label="Acesso à conta">
              <span>
                {registering ? "Já tem uma conta?" : "Ainda não tem uma conta?"}
              </span>
              <Link href={registering ? "/entrar" : "/cadastrar"}>
                {registering ? "Entrar" : "Cadastre-se"}
              </Link>
            </nav>
          )}
          <p className="auth-terms">
            Ao continuar, você concorda com os termos de uso e a política de
            privacidade.
          </p>
          <DesenvolvidoPor />
        </section>
      </div>
    </main>
  );
}
