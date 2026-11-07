# Donda Entregador

App dos entregadores (Expo SDK 58 + React Native + TypeScript, Android e iOS).
O entregador entra com o e-mail e a senha cadastrados no painel
(**Configurações → Entregadores**), vê só as entregas que saíram com ele e marca
cada uma como entregue.

## Testar no celular (Expo Go)

1. Instale o **Expo Go** no celular (Play Store / App Store).
2. Na pasta `mobile/entregador`, crie o `.env.local` a partir do `.env.example`
   (valores **públicos** do Supabase, os mesmos do site).
3. `npm install` e depois `npx expo start`.
4. Escaneie o QR code: no Android pelo Expo Go, no iPhone pela câmera.
   O celular e o computador precisam estar na mesma rede (ou use `npx expo start --tunnel`).

## Publicar o .apk (Android)

Uma única vez: `bash scripts/android/criar-chave-entregador.sh` (na raiz do repositório)
cria a chave de assinatura fora do repositório e cadastra no GitHub o que o build precisa.
**Guarde a chave e a senha**: sem elas as próximas versões não instalam por cima.

Depois, para cada versão: suba `version` em `app.json` e faça o merge na `main`.
O workflow **App do entregador (Android)** gera o `.apk` e publica o release
`entregador-vX.Y.Z`; o painel mostra o botão **Baixar app**.

## Como funciona

- Só usa a chave **pública** do Supabase. Tudo que o entregador pode fazer é decidido
  no banco (migration `0019_entregadores.sql`): funções `entregador_*` e canal privado.
- Tempo real: o banco avisa no canal privado `entregador:<id>` que a lista mudou; o app
  busca de novo. Sem polling; ao reconectar e ao voltar do segundo plano, sincroniza.
- Sessão guardada no SecureStore (Keychain / Keystore).

Checagens: `npx tsc --noEmit` e `npx expo-doctor` aqui; testes em
`scripts/responsive/entregador-app-test.cjs` (rodam com o `npm test` da raiz).
