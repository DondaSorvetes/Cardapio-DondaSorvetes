"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Tag } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

const PREFS_KEY = "donda-prefs";

type Prefs = {
  notificacoes: boolean;
  promocoes: boolean;
};

export function PreferenciasView() {
  const [prefs, setPrefs] = useState<Prefs>({
    notificacoes: true,
    promocoes: true,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    toast.success("Preferências salvas");
  };

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-primary/[0.04] via-background to-background">
      <div className="mx-auto max-w-lg px-4 py-6 pb-28 space-y-6">
        <div className="flex items-center gap-3">
          <Link prefetch={false}
            href="/perfil/cadastro"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Voltar para Meu cadastro"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Preferências
            </h1>
            <p className="text-xs text-muted-foreground">
              Controle o que você quer receber
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Notificações
                </p>
                <p className="text-xs text-muted-foreground">
                  Status de pedidos e atualizações
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.notificacoes}
              disabled={!ready}
              onCheckedChange={(v) =>
                savePrefs({ ...prefs, notificacoes: v })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Promoções
                </p>
                <p className="text-xs text-muted-foreground">
                  Ofertas e novidades da Sorvetes Donda
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.promocoes}
              disabled={!ready}
              onCheckedChange={(v) => savePrefs({ ...prefs, promocoes: v })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
