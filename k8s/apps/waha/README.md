# WAHA — WhatsApp HTTP API

StatefulSet (`devlikeapro/waha:latest`) no namespace `controle-contas`.

## Recursos

| Recurso | Nome |
|---------|------|
| StatefulSet | `waha` |
| Service | `waha:3000` |
| Secret | `waha-credentials` |
| PVC | `waha-sessions-waha-0` (5Gi) |
| HTTPRoute | `botzap.example.com` → Gateway `public` / `https` |

## URLs

| Uso | URL |
|-----|-----|
| Público (dashboard / QR / n8n) | `https://botzap.example.com` |
| Interno (backend) | `http://waha:3000` |

## Credenciais

1. Copie `overlays/prd/secret.yaml.example` → `secret.yaml` e defina `WAHA_API_KEY` + senha do dashboard.
2. Selec:

```bash
kubeseal --format yaml --cert sealed-secrets/overlays/prd/prd-pub.pem \
  < apps/waha/overlays/prd/secret.yaml \
  > apps/waha/overlays/prd/sealedsecret.yaml
```

3. Commit **apenas** `sealedsecret.yaml` (nunca `secret.yaml`).

## DNS

Crie o A record `botzap.example.com` → `192.168.3.11` (mesmo IP do Gateway).

## Pós-deploy

1. Abra `https://botzap.example.com` e faça login no dashboard.
2. **Apague sessões FAILED** se existirem.
3. Crie/start a session com nome exatamente `default` (ou configure `WAHA_SESSION` no backend) e escaneie o QR no WhatsApp.
4. Backend usa `WAHA_BASE_URL=http://waha:3000` + a mesma `WAHA_API_KEY` (via Secret `waha-credentials`).

**Importante:** o backend envia mensagens só na session configurada (`WAHA_SESSION`, padrão `default`). Se a session no dashboard tiver outro nome (ex. `session_01...`), as mensagens falham mesmo com status WORKING.

## Troubleshooting WEBJS (`status: FAILED`)

Chromium precisa de memória e `/dev/shm`. O StatefulSet já monta `emptyDir` em `/dev/shm` e limita RAM em 2Gi.

```bash
kubectl apply -k k8s/apps/waha/overlays/prd
kubectl -n controle-contas delete pod waha-0   # reinicia com novo spec
kubectl -n controle-contas logs waha-0 -f
```

Se continuar falhando, teste engine `NOWEB` (`WHATSAPP_DEFAULT_ENGINE=NOWEB` no StatefulSet).
