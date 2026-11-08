-- Rollback de 0025_limites_conexoes.sql: volta aos padrões do Supabase
-- (service_role sem limite de tempo, transações ociosas sem encerramento).
BEGIN;

ALTER ROLE service_role RESET statement_timeout;
ALTER ROLE service_role RESET lock_timeout;
ALTER ROLE service_role RESET idle_in_transaction_session_timeout;
ALTER ROLE authenticator RESET idle_in_transaction_session_timeout;

DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I RESET idle_in_transaction_session_timeout',
    current_database()
  );
END;
$$;

NOTIFY pgrst, 'reload config';

COMMIT;
