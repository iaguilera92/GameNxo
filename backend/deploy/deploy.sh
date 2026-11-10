#!/usr/bin/env bash
# Despliegue: lo lanza el webhook (src/api/deploy.ts) como proceso separado, o a mano:  bash deploy/deploy.sh
#   git pull --ff-only  →  npm ci  →  (espera a que no haya partidos)  →  pm2 restart
# Salida en backend/deploy.log. Un solo despliegue a la vez (flock).
# Variables opcionales:  PM2_APP (game-backend) · DEPLOY_BRANCH (main) · DEPLOY_BUILD=1 (npm run build) ·
#                        DEPLOY_WAIT_S (90: espera máxima a que terminen los partidos antes de reiniciar)
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"
PM2_APP="${PM2_APP:-game-backend}"
BRANCH="${DEPLOY_BRANCH:-main}"
PORT="${PORT:-3001}"

exec 9>/tmp/nxogames-deploy.lock
if ! flock -n 9; then
  echo "[$(date -Is)] ya hay un despliegue en curso: se omite"
  exit 0
fi

echo "[$(date -Is)] ===== despliegue de $BRANCH ====="
trap 'echo "[$(date -Is)] ===== DESPLIEGUE FALLÓ (el servidor sigue con la versión anterior) ====="' ERR

git pull --ff-only origin "$BRANCH"
npm ci --no-audit --no-fund
if [ "${DEPLOY_BUILD:-0}" = "1" ]; then npm run build; fi

# reiniciar corta los partidos en curso (el rival ganaría por desconexión): se espera a que se vacíen
for _ in $(seq 1 "${DEPLOY_WAIT_S:-90}"); do
  busy=$(curl -fs "http://127.0.0.1:${PORT}/api/health" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try { const r = JSON.parse(s).rooms; console.log((r.PLAYING || 0) + (r.FULL || 0)); } catch { console.log(0); }
    });' || echo 0)
  [ "$busy" = "0" ] && break
  sleep 1
done

pm2 restart "$PM2_APP" --update-env
echo "[$(date -Is)] ===== despliegue OK ====="
