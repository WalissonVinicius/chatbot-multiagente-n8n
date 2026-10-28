#!/usr/bin/env bash
# Importa as credenciais e o workflow no n8n, publica o workflow e reinicia o n8n
# para ele registrar o webhook. Argumentos extras vão para o docker compose, por exemplo:
#   ./scripts/setup.sh --env-file test/test.env --profile test
set -euo pipefail
cd "$(dirname "$0")/.."

compose=(docker compose "$@")
n8n_cli() { "${compose[@]}" exec -T -u node n8n n8n "$@"; }

wait_for_n8n() {
  for _ in $(seq 1 90); do
    curl -fs http://localhost:5678/healthz >/dev/null && return 0
    sleep 2
  done
  echo "O n8n não respondeu em 3 minutos. Veja: docker compose logs n8n" >&2
  exit 1
}

wait_for_n8n
n8n_cli import:credentials --input=/import/credentials/local.json
n8n_cli import:workflow --input=/import/workflows/chatbot-multiagente.json
n8n_cli publish:workflow --id=chatbotMultiAg01

# O n8n só registra o webhook de um workflow publicado pela CLI depois de reiniciar.
"${compose[@]}" restart n8n

# O /healthz responde antes de os workflows serem ativados, então a espera é pelo
# próprio webhook: um corpo vazio recebe 400 quando ele já existe, e 404 antes disso.
status=""
for _ in $(seq 1 90); do
  status=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    -d '{}' http://localhost:5678/webhook/chatbot || true)
  if [ "$status" = "400" ]; then
    echo "Pronto. Webhook: http://localhost:5678/webhook/chatbot"
    exit 0
  fi
  sleep 2
done
echo "O webhook não ficou disponível (último status: $status). Veja: docker compose logs n8n" >&2
exit 1
