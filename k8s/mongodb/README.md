# MongoDB — Controle Contas

StatefulSet single-node (`mongo:8.0`) no namespace `controle-contas-db`.

## Recursos

| Recurso | Nome |
|---------|------|
| Namespace | `controle-contas-db` |
| StatefulSet | `mongo` |
| Service | `mongo-service:27017` |
| Secret | `mongo-credentials` |
| PVC | `mongo-data-mongo-0` (10Gi, StorageClass default `local-path`) |

## Credenciais

1. Copie `overlays/prd/secret.yaml.example` → `secret.yaml` e defina usuário/senha.
2. Após o sealed-secrets estar no ar, sele:

```bash
kubeseal --format yaml --cert sealed-secrets/overlays/prd/prd-pub.pem \
  < mongodb/overlays/prd/secret.yaml \
  > mongodb/overlays/prd/sealedsecret.yaml
```

3. Inclua `sealedsecret.yaml` no `kustomization.yaml` e faça commit (nunca committe `secret.yaml`).

## Conexão da app

FQDN interno:

`mongo-service.controle-contas-db.svc.cluster.local:27017`

O backend monta `MONGODB_URL` via ExternalSecret a partir das chaves `username` / `password` deste Secret (`authSource=admin`, DB `controle_contas`).
