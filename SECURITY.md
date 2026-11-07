# Segurança — implantação das correções

## Escopo entregue

- Checkout reconstrói itens comuns usando produtos, grupos, opções e preços do banco; rejeita quantidade inválida, opções de outro produto, itens indisponíveis e subtotal divergente. Combos e cupons preservam regras existentes.
- Ações do catálogo, relatórios e status exigem permissões específicas antes do cliente privilegiado. Dashboard exige acesso à página no servidor. Remover a capacidade de relatórios passa a revogar essa leitura também para gerente; a lista de leituras mínimas não a reativa.
- Configuração/frete não confirmados impedem criação do pedido. Requisições JSON têm limite real de 256 KiB; uploads, 11 MiB incluindo multipart, mantendo arquivo máximo de 10 MiB.
- Middleware colocado em src/middleware.ts, no mesmo nível de src/app, para ser reconhecido pelo Next.
- Origens de produção são explícitas; Host não amplia a lista e ausência de Origin/Referer é rejeitada em mutações. Desktop continua usando a origem HTTPS do painel.
- Redis usa contador com expiração atômica; indisponibilidade do Redis configurado bloqueia temporariamente em produção. Logs ocultam credenciais aninhadas; falhas da auditoria são sinalizadas.
- Proxy de imagens só publica Produtos/, Sorveteria/ e configuracoes/ (legado). Não colocar documentos pessoais nessas pastas.
- Next 15.5.28, Sharp 0.35.5, Zod 4.6.7 e dependências transitivas corrigidas. Nenhuma funcionalidade OTP foi adicionada ou alterada.

## Antes de publicar

1. Conferir NEXT_PUBLIC_APP_URL com a origem HTTPS pública. Colocar origens adicionais legítimas, inclusive www/preview quando usados, em ALLOWED_ORIGINS, separadas por vírgula. Não adicionar origens de terceiros.
2. Na Vercel, VERCEL seleciona x-vercel-forwarded-for. Em outra hospedagem, definir TRUSTED_PROXY_IP_HEADER apenas para um cabeçalho sobrescrito por proxy confiável: x-real-ip, cf-connecting-ip ou x-forwarded-for. O aplicativo não deve ser acessível por fora desse proxy. Sem proxy confiável, IP fica unknown e clientes compartilham o limite conservador; validar essa configuração antes do deploy.
3. Configurar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN no servidor para limites compartilhados entre instâncias. Sem Redis, ainda existe somente limite local. Não incluir valores secretos em arquivos versionados. Uma falha do Redis configurado devolve 429 temporário em produção.
4. Executar npm ci, npm test, npm run lint e npm audit --omit=dev --audit-level=moderate. Fazer build com as variáveis de staging; nenhum segredo é necessário nos testes automatizados.

## Políticas reais recebidas do operador

A consulta do projeto mostrou policies extras, incluindo RLS_perfis FOR ALL com id=auth.uid(), permitindo autoalteração de role quando há grant de escrita. Para esse projeto, usar **0018_live_policy_hardening.sql em vez de 0017**. A 0018 é independente de 0016/0017, inclui as 17 policies informadas e protege também perfis; não altera usuários, pedidos ou catálogo. Não executar 0017 depois de 0018.

A 0018 guarda todas as definições anteriores de pedidos, clientes, audit_logs e perfis, recusa nomes inesperados e troca as policies dessas quatro tabelas por SELECTs limitados. INSERT/UPDATE/DELETE dessas tabelas ficam somente pelo backend service_role já autorizado. Ler o próprio perfil permanece permitido; equipe mantém suas leituras e a gestão de perfis continua nas Server Actions protegidas. Testar primeiro com backup/staging e contas distintas. O rollback específico é supabase/rollbacks/0018_live_policy_hardening.sql e restaura as permissões antigas, incluindo os riscos; usar somente para retorno operacional temporário.

O teste scripts/security/live-rls-test.cjs reproduz as 17 policies fornecidas, confirma a autopromoção antes, nega depois e compara integralmente o snapshot após rollback. Nenhuma policy foi aplicada ao projeto da loja pelo agente.

## Banco: staging e ativação separada

Nenhuma migration deste lote foi aplicada ao Supabase da loja. Os testes de SQL usam PostgreSQL local isolado (PGlite), com identidades fictícias e políticas, nunca service_role para simular clientes.

1. Exportar policies, grants, views, funções, triggers, schemas expostos e publicação Realtime do projeto real. Fazer backup e revisar diferenças com o schema esperado. Não usar as migrations antigas como prova do estado implantado.
2. Aplicar 0016_checkout_session_controls.sql primeiro em staging. A mudança é aditiva: índice único por cliente/chave e tabela de sessões revogadas, sem leitura pública. Com as flags desligadas, o app não exige esses recursos.
3. Validar pedidos simultâneos com a mesma Idempotency-Key e payload: só um pedido e um consumo do cupom. Payload diferente com a mesma chave deve falhar; clientes diferentes podem usar chaves iguais. O cliente reutiliza a chave ao repetir uma tentativa inalterada na mesma sacola e bloqueia duplo clique.
4. Depois de validar, habilitar CHECKOUT_IDEMPOTENCY_ENABLED=true. Todos os clientes de checkout precisam enviar Idempotency-Key; o frontend desta PR já envia. Aplicar migration e disponibilizar frontend antes da flag. Chaves não são um mecanismo de autenticação: buscas são sempre filtradas pelo cliente da sessão.
5. Validar login e logout em staging com SESSION_REVOCATION_ENABLED=true: a cópia anterior do JWT deve ser rejeitada após logout. Tokens existentes com jti continuam válidos até expiração/revogação, sem exigir logout geral. Sem acesso à tabela a verificação falha fechada. Definir rotina de limpeza somente para expires_at vencido.
6. Revisar/aplicar 0017_staff_scoped_rls.sql em staging. Ela recusa policies inesperadas, salva as definições exatas antes da alteração e restringe as policies amplas conhecidas. Verificar anon, usuário autenticado sem perfil, dois clientes, atendente, gerente, admin e perfis customizados. Leituras de painel e eventos Realtime devem permanecer funcionais. Escritas administrativas continuam via backend autorizado; não deve existir escrita direta liberada por outra policy.
7. Validar a reversão com supabase/rollbacks/0017_staff_scoped_rls.sql. Ela restaura o snapshot exato, inclusive as permissões antigas; usá-la só como retorno operacional temporário. Não apagar o snapshot nem pedidos. Só após staging aprovado planejar aplicação na loja.

## Reversão da aplicação

Reverter os commits e o lockfile deste lote. Antes, desligar CHECKOUT_IDEMPOTENCY_ENABLED e SESSION_REVOCATION_ENABLED. Não remover colunas, registros nem índice de pedidos; rollback 0016 é não destrutivo. Desligar revogação volta ao comportamento anterior e pode revalidar uma cópia de token não expirada, portanto é uma ação de incidente/rollback, não um ajuste rotineiro.

## Validação e limites

npm test inclui testes funcionais, regressões de segurança e SQL/rollback. npm run test:security executa o subconjunto de segurança. O workflow web bloqueia regressões, falhas de lint e alertas de dependências de produção. Recomendações automáticas de downgrade/--force não foram aplicadas. Alertas moderados remanescentes das ferramentas de desenvolvimento/empacotamento exigem triagem separada.

O repositório não configura infraestrutura externa de alertas, retenção dos logs ou segredos do deploy. Responsável pela operação deve restringir acesso aos logs, definir retenção e alertar para negações repetidas, 429, falha do Redis e audit_persistence_failed. O controle de código não substitui revisão do projeto Supabase real.

Referências: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://vercel.com/docs/headers/request-headers ; https://zod.dev/v4/changelog
