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
wait_for_n8n
echo "Pronto. Webhook: http://localhost:5678/webhook/chatbot"
