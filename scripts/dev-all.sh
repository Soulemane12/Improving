#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
NEXT_LOG="${NEXT_LOG:-/tmp/voice-next-dev.log}"
NGROK_LOG="${NGROK_LOG:-/tmp/voice-ngrok.log}"
ENDPOINTS_FILE="${AIRIA_ENDPOINTS_FILE:-/tmp/voice-airia-endpoints.txt}"

next_pid=""
ngrok_pid=""
started_next=0

cleanup() {
  if [[ "${started_next}" -eq 1 ]] && [[ -n "${next_pid}" ]] && kill -0 "${next_pid}" >/dev/null 2>&1; then
    kill "${next_pid}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${ngrok_pid}" ]] && kill -0 "${ngrok_pid}" >/dev/null 2>&1; then
    kill "${ngrok_pid}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${PORT} already in use. Reusing existing local server."
else
  echo "Starting Next.js on http://localhost:${PORT}"
  npm run dev:web -- -p "${PORT}" >"${NEXT_LOG}" 2>&1 &
  next_pid=$!
  started_next=1
fi

ready=0
for _ in {1..60}; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/" 2>/dev/null || true)
  if [[ "${code}" != "000" ]]; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "${ready}" -ne 1 ]]; then
  echo "Next.js did not start. Check ${NEXT_LOG}"
  exit 1
fi

echo "Starting ngrok tunnel for port ${PORT}"
ngrok http "${PORT}" --log=stdout >"${NGROK_LOG}" 2>&1 &
ngrok_pid=$!

public_url=""
for _ in {1..60}; do
  if command -v jq >/dev/null 2>&1; then
    public_url=$(curl -sS http://127.0.0.1:4040/api/tunnels 2>/dev/null \
      | jq -r '.tunnels[] | select(.proto=="https") | .public_url' \
      | head -n1 || true)
  else
    public_url=$(curl -sS http://127.0.0.1:4040/api/tunnels 2>/dev/null \
      | sed -n 's/.*"public_url":"\([^"]*\)".*/\1/p' \
      | grep '^https://' \
      | head -n1 || true)
  fi

  if [[ -n "${public_url}" ]] && [[ "${public_url}" != "null" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "${public_url}" ]] || [[ "${public_url}" == "null" ]]; then
  echo "ngrok URL not ready. Check ${NGROK_LOG}"
  exit 1
fi

input_url="${public_url}/api/airia-tools/input"
tldr_url="${public_url}/api/airia-tools/tldr-improve"

cat >"${ENDPOINTS_FILE}" <<EOF
PUBLIC_URL=${public_url}
INPUT_TOOL_URL=${input_url}
TLDR_IMPROVE_TOOL_URL=${tldr_url}
EOF

echo
echo "Airia tool URLs ready:"
echo "  INPUT TOOL: ${input_url}"
echo "  TLDR TOOL : ${tldr_url}"
echo "Saved to: ${ENDPOINTS_FILE}"
echo
echo "Logs:"
echo "  Next.js: ${NEXT_LOG}"
echo "  ngrok  : ${NGROK_LOG}"
echo

if [[ "${started_next}" -eq 1 ]] && [[ -n "${next_pid}" ]]; then
  wait "${next_pid}"
else
  wait "${ngrok_pid}"
fi
