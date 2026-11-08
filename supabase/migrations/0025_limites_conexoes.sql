-- 0025 — Limites de tempo para consultas e conexões ociosas.
--
-- O site e o painel não abrem conexões diretas com o Postgres: tudo passa pelo
-- PostgREST (API do Supabase), que mantém um pool de conexões e fecha as
-- ociosas sozinho. O que trava o banco é uma conexão do pool presa: consulta
-- que não termina, espera por lock ou transação aberta e esquecida. Assim:
--
-- * service_role (servidor do site): consulta acima de 15s é cancelada e espera
--   por lock acima de 5s desiste. anon/authenticated já têm 3s/8s do Supabase.
-- * Transação aberta e parada ("idle in transaction") é encerrada: 30s nas
--   conexões da API (authenticator) e 60s em qualquer outra sessão do banco
--   (SQL Editor, scripts, backup).
--
-- Não usa idle_session_timeout: derrubaria as conexões ociosas do pool do
-- PostgREST/Supavisor, que já são fechadas por eles mesmos.
-- Os limites do app por instância ficam em src/integrations/supabase/db-fetch.ts
-- (o timeout de lá, 20s, é maior que o daqui para o banco cancelar antes).
--
-- Rollback: supabase/rollbacks/0025_limites_conexoes.sql

BEGIN;

ALTER ROLE service_role SET statement_timeout = '15s';
ALTER ROLE service_role SET lock_timeout = '5s';
ALTER ROLE service_role SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '30s';

DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET idle_in_transaction_session_timeout = %L',
    current_database(),
    '60s'
  );
END;
$$;

-- PostgREST relê as configurações dos papéis sem reiniciar.
NOTIFY pgrst, 'reload config';

COMMIT;
