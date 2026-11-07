"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Endereco } from "@/types/endereco";
import { salvarEnderecoExistente } from "@/actions/cliente-enderecos";

export function FormularioEndereco({ endereco, cepInicial }: { endereco?: Endereco; cepInicial?: string } = {}) {
  const router = useRouter();
  const { refreshCliente } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [formData, setFormData] = useState({
    apelido: endereco?.apelido || "",
    logradouro: endereco?.logradouro || "",
    numero: endereco?.numero || "",
    complemento: endereco?.complemento || "",
    bairro: endereco?.bairro || "",
    cidade: endereco?.cidade || "",
    estado: endereco?.estado || "",
    cep: endereco?.cep || "",
    principal: endereco?.principal || false,
  });
  const [erro, setErro] = useState("");
  const submitting = useRef(false);
  const cepRequest = useRef(0);
  const goBack = () => {
    if (sessionStorage.getItem("reopenCart") === "true") {
      window.location.href = "/";
      return;
    }
    router.push("/perfil/enderecos");
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setCarregando(true);
    setErro("");
    try {
      if (endereco) {
        const result = await salvarEnderecoExistente(endereco.id, formData);
        if (!result.sucesso) {
          setErro(result.erro || "Não foi possível salvar o endereço.");
          return;
        }
      } else {
        const resposta = await fetch("/api/enderecos/adicionar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!resposta.ok) {
          const dados = await resposta.json();
          setErro(dados.erro || "Erro ao adicionar endereço");
          return;
        }
      }
      toast.success(endereco ? "Endereço atualizado!" : "Endereço adicionado!");
      await refreshCliente();
      if (sessionStorage.getItem("reopenCart") === "true") {
        window.location.href = "/";
        return;
      }
      router.push("/perfil/enderecos");
      router.refresh();
    } catch {
      setErro(
        "Não foi possível salvar. Confira sua conexão e tente novamente.",
      );
    } finally {
      submitting.current = false;
      setCarregando(false);
    }
  };
  const handleCepChange = async (value: string) => {
    const cep = value.replace(/\D/g, "").slice(0, 8);
    const request = ++cepRequest.current;
    setFormData((prev) => ({ ...prev, cep }));
    setBuscandoCep(false);
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      // Pelo próprio servidor: a CSP do site bloqueia chamar o ViaCEP direto do navegador.
      const response = await fetch(`/api/cep/${cep}`);
      const data = await response.json().catch(() => ({}));
      if (request !== cepRequest.current) return;
      if (response.status === 404) {
        toast.error("CEP não encontrado");
        return;
      }
      if (!response.ok) throw new Error(data.erro);
      setFormData((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.cidade || prev.cidade,
        estado: data.estado || prev.estado,
      }));
      toast.success("CEP encontrado!");
    } catch {
      if (request === cepRequest.current)
        toast.error(
          "Erro ao buscar CEP. Você pode preencher o endereço manualmente.",
        );
    } finally {
      if (request === cepRequest.current) setBuscandoCep(false);
    }
  };
  // CEP digitado na sacola ("Buscar CEP"): preenche e busca ao abrir.
  const cepInicialBuscado = useRef(false);
  useEffect(() => {
    if (endereco || cepInicialBuscado.current) return;
    const digitos = (cepInicial ?? "").replace(/\D/g, "");
    if (digitos.length !== 8) return;
    cepInicialBuscado.current = true;
    void handleCepChange(digitos);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na abertura
  }, []);
  const fieldStyle = "h-11 rounded-lg border-input text-base shadow-none";
  return (
    <main className="mx-auto max-w-lg px-5 pb-28 pt-5 sm:pt-8">
      <header className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          disabled={carregando}
          aria-label="Voltar para meus endereços"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">
          {endereco ? "Editar endereço" : "Adicionar endereço"}
        </h1>
      </header>
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={carregando} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="address-name">Identificação</Label>
            <Input
              id="address-name"
              placeholder="Casa, Trabalho…"
              autoComplete="off"
              value={formData.apelido}
              onChange={(e) =>
                setFormData({ ...formData, apelido: e.target.value })
              }
              required
              minLength={2}
              className={fieldStyle}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address-cep">CEP</Label>
            <div className="relative">
              <Input
                id="address-cep"
                inputMode="numeric"
                autoComplete="postal-code"
                value={formData.cep.replace(/^(\d{5})(\d)/, "$1-$2")}
                onChange={(e) => void handleCepChange(e.target.value)}
                maxLength={9}
                required
                className={fieldStyle}
              />
              {buscandoCep && (
                <Loader2
                  aria-hidden="true"
                  size={16}
                  className="absolute right-3 top-3.5 animate-spin text-primary"
                />
              )}
            </div>
            <p role="status" className="text-xs text-muted-foreground">
              {buscandoCep
                ? "Buscando endereço…"
                : "Preencha o CEP para localizar o endereço."}
            </p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="address-street">Rua</Label>
              <Input
                id="address-street"
                autoComplete="address-line1"
                value={formData.logradouro}
                onChange={(e) =>
                  setFormData({ ...formData, logradouro: e.target.value })
                }
                required
                minLength={3}
                className={fieldStyle}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-number">Número</Label>
              <Input
                id="address-number"
                value={formData.numero}
                onChange={(e) =>
                  setFormData({ ...formData, numero: e.target.value })
                }
                required
                className={fieldStyle}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address-extra">
              Complemento{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Input
              id="address-extra"
              autoComplete="address-line2"
              value={formData.complemento}
              onChange={(e) =>
                setFormData({ ...formData, complemento: e.target.value })
              }
              className={fieldStyle}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address-district">Bairro</Label>
            <Input
              id="address-district"
              value={formData.bairro}
              onChange={(e) =>
                setFormData({ ...formData, bairro: e.target.value })
              }
              required
              minLength={2}
              className={fieldStyle}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="address-city">Cidade</Label>
              <Input
                id="address-city"
                autoComplete="address-level2"
                value={formData.cidade}
                onChange={(e) =>
                  setFormData({ ...formData, cidade: e.target.value })
                }
                required
                minLength={2}
                className={fieldStyle}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-state">UF</Label>
              <Input
                id="address-state"
                autoComplete="address-level1"
                maxLength={2}
                minLength={2}
                value={formData.estado}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estado: e.target.value.toUpperCase(),
                  })
                }
                required
                className={fieldStyle}
              />
            </div>
          </div>
          {!endereco && (
            <div className="flex min-h-11 items-center gap-3">
              <Checkbox
                id="principal"
                checked={formData.principal}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, principal: checked === true })
                }
              />
              <Label
                htmlFor="principal"
                className="cursor-pointer text-sm font-normal"
              >
                Definir como endereço principal
              </Label>
            </div>
          )}
        </fieldset>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
        <Button
          type="submit"
          disabled={carregando || buscandoCep}
          className="min-h-11 w-full rounded-lg"
        >
          {carregando && (
            <Loader2
              aria-hidden="true"
              size={16}
              className="mr-2 animate-spin"
            />
          )}
          {carregando ? "Salvando…" : "Salvar endereço"}
        </Button>
      </form>
    </main>
  );
}
