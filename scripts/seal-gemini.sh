#!/usr/bin/env bash
set -euo pipefail
REPO="/mnt/c/Users/eduar/Documents/GitHub/controle_contas"
ENV_FILE="$REPO/app/backend/.env"
OUT_DIR="$REPO/k8s/apps/controle-contas/back/overlays/prd"
CERT="$REPO/k8s/prd-pub.pem"
SECRET_FILE="$OUT_DIR/gemini-secret.yaml"
SEALED_FILE="$OUT_DIR/gemini-sealedsecret.yaml"

KEY="$(grep -E '^GEMINI_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
if [[ -z "$KEY" ]]; then
  echo "missing GEMINI_API_KEY" >&2
  exit 1
fi

export GEMINI_KEY_FOR_SEAL="$KEY"
python3 - <<'PY'
import os
from pathlib import Path
key = os.environ["GEMINI_KEY_FOR_SEAL"]
path = Path("/mnt/c/Users/eduar/Documents/GitHub/controle_contas/k8s/apps/controle-contas/back/overlays/prd/gemini-secret.yaml")
esc = key.replace("\\", "\\\\").replace('"', '\\"')
path.write_text(
    f"""apiVersion: v1
kind: Secret
metadata:
  name: controle-contas-gemini
  namespace: controle-contas
type: Opaque
stringData:
  GEMINI_API_KEY: "{esc}"
""",
    encoding="utf-8",
)
print("wrote_secret")
PY
unset GEMINI_KEY_FOR_SEAL

kubeseal --format yaml --cert "$CERT" < "$SECRET_FILE" > "$SEALED_FILE"
rm -f "$SECRET_FILE"

if grep -q 'GEMINI_API_KEY: Ag' "$SEALED_FILE"; then
  echo "sealed_ok"
  wc -c "$SEALED_FILE"
else
  echo "seal_failed" >&2
  head -20 "$SEALED_FILE" >&2 || true
  exit 1
fi
