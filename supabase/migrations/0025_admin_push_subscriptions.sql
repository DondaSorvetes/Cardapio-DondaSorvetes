-- 0025 — Notificação de pedido novo no celular da equipe (Web Push do app do painel).
--
-- Cada linha é um aparelho (navegador/app instalado) que aceitou receber avisos.
-- O endpoint + chaves permitem mandar notificação para aquele aparelho, então a
-- tabela fica fechada: sem acesso para anon/authenticated, só o servidor
-- (service_role) lê e grava. Quem recebe é decidido no envio: só quem ainda tem
-- acesso à tela de Pedidos.
--
-- Rollback: supabase/rollbacks/0025_admin_push_subscriptions.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
  p256dh text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth text NOT NULL CHECK (char_length(auth) <= 100),
  user_agent text CHECK (char_length(user_agent) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_push_subscriptions_user_idx
  ON public.admin_push_subscriptions (user_id);

ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_push_subscriptions TO service_role;

COMMIT;
