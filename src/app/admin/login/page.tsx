"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminNeedsMfa } from "@/lib/security/admin-mfa";
import { cn } from "@/lib/utils";
import { imageProxyUrl } from "@/lib/image/proxy-url";
import { Checkbox } from "@/components/ui/checkbox";
import {
  firstAllowedAdminPath,
  resolveAdminRole,
  resolveAcessos,
} from "@/lib/security/rbac";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Informe um e-mail válido.")
    .email("Informe um e-mail válido.")
    .max(160),
  password: z.string().min(1, "Senha obrigatória.").max(128),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

type Phase = "idle" | "loading" | "success" | "error";

function logAdminLoginError(stage: string, error: unknown) {
  if (error && typeof error === "object") {
    const value = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
    };
    console.error(`[AdminLogin] ${stage}`, {
      code: value.code,
      message: value.message,
      details: value.details,
      hint: value.hint,
      status: value.status,
    });
    return;
  }
  console.error(`[AdminLogin] ${stage}`, error);
}

/** Imagem da loja (coluna esquerda) */
const HERO_IMAGE = imageProxyUrl("Loja/donda-fundo.png")!;

/** Logo tipográfica Sorvetes Donda */
const LOGO_TEXT_URL = imageProxyUrl("Loja/donda-logo.png")!;

const REMEMBER_KEY = "donda-admin-email";

export default function AdminLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
  });

  const remember = watch("remember");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setValue("email", saved);
        setValue("remember", true);
      }
    } catch {
      // ignore
    }
  }, [setValue]);

  const busy = phase === "loading" || phase === "success";

  const onSubmit = async (data: LoginForm) => {
    if (busy) return;
    setPhase("loading");
    setFormError(null);

    try {
      console.info("[AdminLogin] Iniciando autenticação no Supabase.");
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      if (error) {
        logAdminLoginError("signInWithPassword falhou", error);
        setPhase("error");
        // Anti-enumeração: mensagem única
        setFormError("E-mail ou senha inválidos.");
        return;
      }
      console.info("[AdminLogin] Credenciais aceitas pelo Supabase Auth.");

      try {
        if (data.remember) {
          localStorage.setItem(REMEMBER_KEY, data.email.trim().toLowerCase());
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        // ignore
      }

      // Confirma staff na tabela perfis. Sem linha = sem painel.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user;

      if (userError) logAdminLoginError("getUser falhou", userError);

      if (!user) {
        console.error("[AdminLogin] Auth não retornou usuário após autenticação.");
        setPhase("error");
        setFormError("E-mail ou senha inválidos.");
        return;
      }

      if (await adminNeedsMfa(supabase, user)) {
        router.replace('/admin/verificar'); router.refresh(); return;
      }

      let perfil: { role: string | null; acessos?: string[] | null } | null =
        null;

      const full = await supabase
        .from("perfis")
        .select("role, acessos")
        .eq("id", user.id)
        .maybeSingle();

      if (full.error) {
        logAdminLoginError("Consulta de perfis (role, acessos) falhou; tentando fallback só com role", full.error);
        const basic = await supabase
          .from("perfis")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (!basic.error && basic.data) {
          perfil = { role: basic.data.role, acessos: null };
          console.info("[AdminLogin] Fallback de perfis funcionou.", {
            role: basic.data.role,
          });
        } else if (basic.error) {
          logAdminLoginError("Consulta de fallback de perfis (role) falhou", basic.error);
        } else {
          console.error("[AdminLogin] Fallback de perfis não encontrou uma linha para o usuário autenticado.");
        }
      } else {
        perfil = full.data;
        console.info("[AdminLogin] Consulta de perfil funcionou.", {
          perfilEncontrado: Boolean(full.data),
          role: full.data?.role ?? null,
        });
      }

      if (!perfil) {
        await supabase.auth.signOut();
        setPhase("error");
        setFormError(
          "Seu usuário não tem perfil de acesso ao painel. Fale com o administrador."
        );
        return;
      }

      const role = resolveAdminRole(perfil.role);
      const acessos = resolveAcessos(role, perfil.acessos ?? null);
      const dest = firstAllowedAdminPath(acessos);
      console.info("[AdminLogin] Perfil autorizado; redirecionando para", dest);

      setPhase("success");
      await new Promise((r) => setTimeout(r, 1100));
      router.push(dest);
      router.refresh();
    } catch (error) {
      logAdminLoginError("Erro inesperado no fluxo de login", error);
      setPhase("error");
      setFormError("E-mail ou senha inválidos.");
    }
  };

  return (
    <div className="relative min-h-dvh w-full bg-white">
      {/* Overlay de carregamento / sucesso */}
      <AnimatePresence>
        {(phase === "loading" || phase === "success") && (
          <motion.div
            key="login-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex w-full max-w-xs flex-col items-center px-6 text-center">
              {/* Anel animado + logo */}
              <div className="relative mb-8 flex h-28 w-28 items-center justify-center">
                {/* Anel externo */}
                <motion.div
                  className="absolute inset-0 rounded-full border-[3px] border-[#FDE6EE]"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#C8285F] border-r-[#E33E70]/40"
                  animate={
                    phase === "loading"
                      ? { rotate: 360 }
                      : { rotate: 0, scale: 1.05 }
                  }
                  transition={
                    phase === "loading"
                      ? { duration: 0.9, repeat: Infinity, ease: "linear" }
                      : { duration: 0.35 }
                  }
                />
                {/* Centro */}
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F8F5FC]">
                  <AnimatePresence mode="wait">
                    {phase === "loading" ? (
                      <motion.div
                        key="logo-load"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative h-10 w-[72px]"
                      >
                        <Image
                          src={LOGO_TEXT_URL}
                          alt=""
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="ok"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 18,
                        }}
                      >
                        <CheckCircle2 className="h-10 w-10 text-[#C8285F]" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {phase === "loading" ? (
                  <motion.div
                    key="txt-loading"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-2"
                  >
                    <p className="text-base font-semibold text-[#111827]">
                      Autenticando…
                    </p>
                    <p className="text-sm text-[#6B7280]">
                      Validando suas credenciais
                    </p>
                    {/* Barra de progresso indeterminada */}
                    <div className="mx-auto mt-4 h-1 w-40 overflow-hidden rounded-full bg-[#FDE6EE]">
                      <motion.div
                        className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#C8285F] to-[#E33E70]"
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{
                          duration: 1.1,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="txt-ok"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    <p className="text-base font-semibold text-[#111827]">
                      Acesso liberado
                    </p>
                    <p className="text-sm text-[#6B7280]">
                      Entrando no painel administrativo…
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="grid min-h-dvh w-full lg:grid-cols-[55%_45%]"
      >
        {/* ── Coluna esquerda: imagem ── */}
        <div className="relative hidden min-h-dvh overflow-hidden lg:block">
          <Image
            src={HERO_IMAGE}
            alt="Sorvetes Donda — seguindo a tradição desde 1953"
            fill
            priority
            className="object-cover object-center"
            sizes="55vw"
            quality={90}
          />
          {/* Arte do cardápio Donda com o logo no centro */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-16 text-center">
            <div className="relative aspect-square w-[min(60%,420px)]">
              <Image
                src={LOGO_TEXT_URL}
                alt=""
                fill
                className="object-contain drop-shadow-xl"
                sizes="420px"
                unoptimized
              />
            </div>
            <p className="max-w-sm text-lg font-semibold leading-snug text-[#2A1A22]">
              Gestão da loja com a mesma qualidade dos nossos sorvetes.
            </p>
          </div>
        </div>

        {/* ── Coluna direita: formulário ── */}
        <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
            className="w-full max-w-[450px]"
          >
            {/* Logo oficial (imagem) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="mb-8 flex justify-center lg:hidden"
            >
              <div className="relative h-[120px] w-[120px] sm:h-[140px] sm:w-[140px]">
                <Image
                  src={LOGO_TEXT_URL}
                  alt="Sorvetes Donda"
                  fill
                  priority
                  className="object-contain object-center"
                  sizes="300px"
                  unoptimized
                />
              </div>
            </motion.div>

            <div className="mb-7 text-center sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-[28px]">
                Painel Administrativo
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                Entre com seu e-mail e senha para acessar o painel
                administrativo da Sorvetes Donda.
              </p>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
              noValidate
            >
              {/* E-mail */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email"
                  className="block text-sm font-medium text-[#374151]"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    disabled={busy}
                    placeholder="Digite seu e-mail"
                    className={cn(
                      "h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-base sm:text-sm text-[#111827]",
                      "placeholder:text-[#9CA3AF] outline-none transition-all duration-150",
                      "focus:border-[#C8285F] focus:ring-2 focus:ring-[#C8285F]/15",
                      "disabled:opacity-60",
                      errors.email
                        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                        : "border-[#E5E7EB]"
                    )}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-medium text-[#374151]"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    disabled={busy}
                    placeholder="Digite sua senha"
                    className={cn(
                      "h-12 w-full rounded-xl border bg-white pl-11 pr-12 text-base sm:text-sm text-[#111827]",
                      "placeholder:text-[#9CA3AF] outline-none transition-all duration-150",
                      "focus:border-[#C8285F] focus:ring-2 focus:ring-[#C8285F]/15",
                      "disabled:opacity-60",
                      errors.password
                        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                        : "border-[#E5E7EB]"
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"

                    disabled={busy}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-[#C8285F] -translate-y-1/2 rounded-lg p-1.5 text-[#9CA3AF] transition-colors duration-150 hover:bg-[#F3F4F6] hover:text-[#C8285F]"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Opções */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <Checkbox
                    checked={Boolean(remember)}
                    onCheckedChange={(v) =>
                      setValue("remember", v === true, {
                        shouldDirty: true,
                      })
                    }
                    disabled={busy}
                    className="border-[#D1D5DB] data-[state=checked]:border-[#C8285F] data-[state=checked]:bg-[#C8285F]"
                  />
                  <span className="text-sm text-[#4B5563]">
                    Lembrar de mim
                  </span>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    // Placeholder — recuperação via Supabase resetPasswordForEmail no futuro
                    setFormError(
                      "Fale com o administrador do sistema para redefinir a senha."
                    );
                  }}
                  className="text-sm font-medium text-[#C8285F] transition-colors duration-150 hover:text-[#E33E70] hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* Erro global */}
              <AnimatePresence mode="wait">
                {formError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botão principal */}
              <button
                type="submit"
                disabled={busy}
                className={cn(
                  "relative flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all duration-150",
                  "bg-[#C8285F] hover:bg-[#3d1d70] active:bg-[#351966]",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40 focus-visible:ring-offset-2"
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {phase === "loading" && (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-2"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entrando…
                    </motion.span>
                  )}
                  {phase === "success" && (
                    <motion.span
                      key="success"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Acesso liberado
                    </motion.span>
                  )}
                  {(phase === "idle" || phase === "error") && (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Entrar
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Botão secundário */}
              <Link
                href="/"
                className={cn(
                  "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#374151]",
                  "transition-colors duration-150 hover:border-[#F6BFD2] hover:bg-[#F9FAFB] hover:text-[#C8285F]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/20"
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o site
              </Link>
            </form>

            <footer className="mt-10 text-center text-[11px] text-[#9CA3AF]">
              <p>© 2026 Sorvetes Donda</p>
              <p className="mt-0.5">Versão 1.0</p>
            </footer>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
