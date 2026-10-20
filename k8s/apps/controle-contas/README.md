# Controle Contas — manifests Kubernetes

| App | Path | Image | Porta |
|-----|------|-------|-------|
| Backend | `back/overlays/prd` | `ghcr.io/dudullsc/controle-contas-back:vX.Y.Z` (pin via `back-v*`) | 8000 |
| Frontend | `front/overlays/prd` | `ghcr.io/dudullsc/controle-contas-front:vX.Y.Z` (pin via `front-v*`) | 3000 |
| WAHA | [`../waha`](../waha) | `devlikeapro/waha:latest` | 3000 |

Host público: `contas.example.com`

- `/api` → backend
- `/` → frontend

WAHA (WhatsApp): `https://botzap.example.com` — ver [`../waha/README.md`](../waha/README.md).

## Release versionado (frontend e backend separados)

Cada serviço tem versão própria. Alteração só no front **não** sobe versão do back, e vice-versa.

| Serviço | Tag git | Imagem publicada | Overlay atualizado |
|---------|---------|------------------|--------------------|
| Frontend | `front-v1.0.14` | `controle-contas-front:v1.0.14` | `front/overlays/prd` |
| Backend | `back-v1.0.14` | `controle-contas-back:v1.0.14` | `back/overlays/prd` |

### Frontend

1. Atualize `app/frontend/package.json` e `app/frontend/src/lib/appVersion.ts`
2. Commit e push na `main`
3. Tag e envie:

```bash
git tag front-v1.0.14
git push origin front-v1.0.14
```

### Backend

1. Atualize o default de `APP_VERSION` no backend se necessário
2. Commit e push na `main`
3. Tag e envie:

```bash
git tag back-v1.0.14
git push origin back-v1.0.14
```

O workflow `.github/workflows/release.yml` builda **só** o componente da tag, publica a imagem e pina o overlay correspondente.

Rollback: edite o overlay do serviço para uma tag anterior e sincronize o cluster.

> Tags antigas `v*` (ex.: `v1.0.13`) não disparam mais este workflow. Use `front-v*` / `back-v*`.

## Build das imagens

Preferido:

- Push na `main` → `.github/workflows/build-images.yml` (`:latest` + sha)
- Tag `front-v*` / `back-v*` → `.github/workflows/release.yml` (versão + pin no k8s)

Manual (opcional). `NEXT_PUBLIC_API_URL` no **build** do frontend:

```bash
docker build -t ghcr.io/dudullsc/controle-contas-back:v1.0.14 \
  -f app/backend/Dockerfile app/backend

docker build -t ghcr.io/dudullsc/controle-contas-front:v1.0.14 \
  --build-arg NEXT_PUBLIC_API_URL=https://contas.example.com/cc-api \
  -f app/frontend/Dockerfile app/frontend
```

## Secrets do backend

1. Copie `back/overlays/prd/secret.yaml.example` → `secret.yaml`
2. Selec com `kubeseal` → `sealedsecret.yaml`
3. Descomente o resource no `kustomization.yaml`

### FCM (push no app fechado)

Secret separado `controle-contas-fcm` (não mexe no `SECRET_KEY`):

1. Use o JSON da service account Firebase → `fcm-secret.yaml` (gitignored)
2. Selec:

```bash
kubeseal --format yaml --cert k8s/prd-pub.pem \
  < k8s/apps/controle-contas/back/overlays/prd/fcm-secret.yaml \
  > k8s/apps/controle-contas/back/overlays/prd/fcm-sealedsecret.yaml
```

3. Commit **apenas** `fcm-sealedsecret.yaml` (já está no `kustomization.yaml`).
4. Deploy também precisa da **imagem do backend** com o código FCM (push no GitHub → build da image).
