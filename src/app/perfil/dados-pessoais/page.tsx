"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/utils/formatters";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type Customer = { nome: string | null; telefone: string | null };
function PersonalForm({
  cliente,
  onRefresh,
}: {
  cliente: Customer;
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(cliente.nome || "");
  const [telefone, setTelefone] = useState(cliente.telefone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const busy = useRef(false);
  const dirty =
    nome !== (cliente.nome || "") ||
    telefone.replace(/\D/g, "") !== (cliente.telefone || "").replace(/\D/g, "");
  const back = () => {
    if (busy.current) return;
    if (dirty) setDiscard(true);
    else router.push("/perfil/cadastro");
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clientes/atualizar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.erro || "Não foi possível salvar seus dados. Tente novamente.",
        );
        return;
      }
      toast.success("Dados atualizados");
      await onRefresh();
      router.push("/perfil/cadastro");
    } catch {
      setError(
        "Não foi possível concluir. Confira sua conexão e tente novamente.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <main className="mx-auto min-h-[70vh] max-w-lg px-5 pb-28 pt-5 sm:pt-8">
      <header className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={back}
          disabled={saving}
          aria-label="Voltar para Meu cadastro"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">Dados pessoais</h1>
      </header>
      <form onSubmit={save} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="personal-name">Nome completo</Label>
          <Input
            id="personal-name"
            autoComplete="name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            minLength={3}
            maxLength={120}
            required
            disabled={saving}
            className="h-11 rounded-lg border-input text-base shadow-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="personal-phone">Telefone</Label>
          <Input
            id="personal-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={formatPhone(telefone)}
            onChange={(event) =>
              setTelefone(event.target.value.replace(/\D/g, "").slice(0, 11))
            }
            required
            disabled={saving}
            className="h-11 rounded-lg border-input text-base shadow-none"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={saving || !dirty || nome.trim().length < 3}
          className="min-h-11 w-full rounded-lg"
        >
          {saving && (
            <Loader2
              aria-hidden="true"
              size={16}
              className="mr-2 animate-spin"
            />
          )}
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Seus dados ainda não foram salvos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/perfil/cadastro")}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
export default function DadosPessoaisPage() {
  const { cliente, loading, refreshCliente } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !cliente) router.replace("/entrar");
  }, [loading, cliente, router]);
  if (loading)
    return (
      <div
        role="status"
        className="mx-auto max-w-lg px-5 py-8 text-sm text-muted-foreground"
      >
        Carregando seus dados…
      </div>
    );
  if (!cliente) return null;
  return <PersonalForm cliente={cliente} onRefresh={refreshCliente} />;
}
