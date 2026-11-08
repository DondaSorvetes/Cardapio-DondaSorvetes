# Cardapio-DondaSorvetes

## Conexões com o banco (Vercel / serverless)

O site não abre conexões diretas com o Postgres. O servidor usa o `supabase-js`, que
fala HTTPS com o PostgREST (API do Supabase), e é o PostgREST que mantém o pool de
conexões com o banco e fecha as ociosas.

- **Cliente reaproveitado:** `createServiceRoleClient()` devolve um único cliente por
  instância serverless (`src/integrations/supabase/client.server.ts`), sem sessão de
  usuário. O hub de pedidos em tempo real usa um cliente próprio
  (`createDedicatedServiceRoleClient()`) porque abre e fecha o próprio websocket.
- **Limites por instância** (`src/integrations/supabase/db-fetch.ts`), opcionais na Vercel:

  | Variável | Padrão | O que faz |
  | --- | --- | --- |
  | `SUPABASE_DB_MAX_CONCURRENT` | 10 | requisições ao banco ao mesmo tempo |
  | `SUPABASE_DB_MAX_QUEUE` | 100 | requisições esperando vaga (acima disso falha na hora) |
  | `SUPABASE_DB_QUEUE_TIMEOUT_MS` | 10000 | tempo máximo esperando vaga |
  | `SUPABASE_DB_REQUEST_TIMEOUT_MS` | 20000 | tempo máximo de cada requisição |

- **Limites no banco:** a migration `supabase/migrations/0025_limites_conexoes.sql`
  cancela consultas do `service_role` acima de 15s, desiste de locks após 5s e encerra
  transações paradas (30s na API, 60s nas demais sessões). Aplique no SQL Editor do
  Supabase; o rollback fica em `supabase/rollbacks/`.
