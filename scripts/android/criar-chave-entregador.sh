#!/usr/bin/env bash
# Cria (uma única vez) a chave que assina o .apk do app do entregador e cadastra
# no GitHub o que o workflow "App do entregador (Android)" precisa.
#
#   bash scripts/android/criar-chave-entregador.sh
#
# - A chave fica FORA do repositório, em ~/Donda-chaves/. Guarde uma cópia
#   (e a senha, no gerenciador de senhas): sem ela, as próximas versões do app não
#   instalam por cima da anterior (o Android exige a mesma assinatura).
# - Nada secreto é impresso na tela.
# - Também cadastra as variáveis PÚBLICAS do Supabase (as mesmas do site) a partir
#   de mobile/entregador/.env.local.
set -euo pipefail

REPO="DondaSorvetes/Cardapio-DondaSorvetes"
DIR="$HOME/Donda-chaves"
P12="$DIR/entregador-android.p12"
ALIAS="donda-entregador"

cd "$(dirname "$0")/../.."
command -v openssl >/dev/null || { echo "Precisa do openssl (vem com o Git para Windows)."; exit 1; }
command -v gh >/dev/null || { echo "Precisa do GitHub CLI (gh) logado."; exit 1; }

if gh secret list --repo "$REPO" | grep -q '^ANDROID_ENTREGADOR_KEYSTORE\b' && [ "${1:-}" != "--substituir" ]; then
  echo "A chave já está cadastrada no GitHub. Trocar a chave impede atualizar o app já instalado."
  echo "Se tiver certeza, rode de novo com --substituir."
  exit 1
fi

mkdir -p "$DIR"
if [ -f "$P12" ] && [ "${1:-}" != "--substituir" ]; then
  echo "Já existe $P12. Para criar outra, rode com --substituir."
  exit 1
fi

PASS="$(openssl rand -base64 30 | tr -d '/+=\n' | cut -c1-32)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# No Git Bash (Windows) o openssl é um programa do Windows: caminhos no formato C:/...
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
# MSYS_NO_PATHCONV evita que o Git Bash transforme "/CN=..." num caminho; por isso
# os caminhos desse comando já vão convertidos.
if ! MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes \
  -keyout "$(native "$TMP/key.pem")" -out "$(native "$TMP/cert.pem")" \
  -subj "/CN=Donda Entregador/O=Sorvetes Donda/C=BR" >/dev/null 2>"$TMP/req.log"; then
  echo "Falha ao criar o certificado:"; tail -3 "$TMP/req.log"; exit 1
fi
openssl pkcs12 -export -inkey "$TMP/key.pem" -in "$TMP/cert.pem" -name "$ALIAS" \
  -out "$P12" -passout "pass:$PASS" -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256
printf '%s\n' "$PASS" > "$DIR/entregador-android.senha.txt"
chmod 600 "$P12" "$DIR/entregador-android.senha.txt" 2>/dev/null || true

base64 -w0 "$P12" | gh secret set ANDROID_ENTREGADOR_KEYSTORE --repo "$REPO"
printf '%s' "$PASS" | gh secret set ANDROID_ENTREGADOR_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS" | gh secret set ANDROID_ENTREGADOR_KEY_ALIAS --repo "$REPO"

ENV_FILE="mobile/entregador/.env.local"
if [ -f "$ENV_FILE" ]; then
  url="$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
  key="$(grep -E '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2-)"
  gh variable set EXPO_PUBLIC_SUPABASE_URL --repo "$REPO" --body "$url"
  gh variable set EXPO_PUBLIC_SUPABASE_ANON_KEY --repo "$REPO" --body "$key"
  echo "Variáveis públicas do Supabase cadastradas."
else
  echo "Sem $ENV_FILE: cadastre EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY em Settings → Variables."
fi

echo
echo "Pronto. Chave salva em: $P12"
echo "Senha salva em:         $DIR/entregador-android.senha.txt"
echo "Guarde os dois num lugar seguro (ex.: gerenciador de senhas) e apague o .txt depois."
