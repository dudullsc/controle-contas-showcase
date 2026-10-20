# k8s — Controle Contas (produto)

Manifests de **deploy deste produto** apenas.

A plataforma GitOps (Argo CD, Gateway, cert-manager, app-of-apps) vive em:

um repositório GitOps separado (privado).

## Estrutura

```
apps/controle-contas/   # backend + frontend
apps/waha/              # WhatsApp (WAHA)
mongodb/                # banco deste produto
overlays/prd/              # removido nesta versão pública (secrets de produção)
```

Applications Argo que apontam para estes paths estão no repositório de plataforma
(`controle-contas-back`, `controle-contas-front`, `controle-contas-db`, `controle-contas-waha`).

## Selar um secret

```bash
kubeseal --format yaml --cert k8s/prd-pub.pem \
  < k8s/apps/.../overlays/prd/secret.yaml \
  > k8s/apps/.../overlays/prd/sealedsecret.yaml
```

Nunca commite `secret.yaml` em claro.
