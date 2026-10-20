# Melhorias de Segurança — Controle de Contas

Documento de acompanhamento das melhorias de segurança identificadas antes de abrir o app para venda com assinatura mensal.

**Objetivo:** reduzir risco de invasão, abuso de endpoints e vazamento de credenciais.

**Como usar:** marque `[x]` conforme for implementando. Priorize sempre a seção 🔴 Urgente.

---

## Legenda de prioridade

| Prioridade | Quando fazer |
|------------|--------------|
| 🔴 **Urgente** | Antes de vender / abrir para clientes pagantes |
| 🟡 **Importante** | Logo após o MVP comercial |
| 🟢 **Billing** | Ao implementar cobrança (Mercado Pago) |
| 🔵 **Infra / contínuo** | Reforço de infra e manutenção recorrente |

---

## 🔴 Urgente — corrigir antes de vender

### 1. JWT acessível por JavaScript (XSS)

**Status:** [x] Implementado (aguardando teste local)

**Problema:** O token ficava em `localStorage` e em cookie definido pelo frontend. Se alguém injetar script malicioso na página, rouba o token e entra como o usuário.

**Correção aplicada:**
- [x] Backend define cookie `HttpOnly` + `Secure` + `SameSite` no login (`utils/auth_cookies.py`)
- [x] `deps.py` lê JWT do cookie **ou** header Bearer (compat. testes/API)
- [x] Endpoint `POST /api/auth/logout` limpa cookie
- [x] Frontend usa `withCredentials: true` — JWT removido do `localStorage`
- [x] Proxy dev no Next.js (`/api` → `localhost:8000`) para cookie funcionar em localhost
- [x] `mobile/www/cc-bridge.js` usa `credentials: 'include'`

**Testar localmente:**
```bash
# Backend (.env com AUTH_COOKIE_SECURE=false se usar HTTP)
cd app/backend && uvicorn main:app --reload

# Frontend (sem NEXT_PUBLIC_API_URL — usa proxy /api)
cd app/frontend && npm run dev
```

**Produção:** manter `AUTH_COOKIE_SECURE=true`. Cookie `Path=/` funciona com `/cc-api` no mesmo domínio.

---

### 2. Sem rate limiting no login

**Status:** [ ] Pendente

**Problema:** Atacante pode tentar milhões de senhas em `/api/auth/login` (força bruta).

**Arquivos afetados:**
- `app/backend/main.py`
- `app/backend/routers/auth.py`

**Correção:**
- [ ] Adicionar `slowapi` (ou equivalente) no FastAPI
- [ ] Limitar login: **5 tentativas por minuto** por IP
- [ ] Limitar login: **5 tentativas por minuto** por email
- [ ] Retornar HTTP 429 com mensagem genérica
- [ ] (Opcional) Bloqueio temporário após N falhas consecutivas

---

### 3. Endpoint de teste WhatsApp aberto para qualquer usuário logado

**Status:** [ ] Pendente

**Problema:** Qualquer conta autenticada pode disparar WhatsApp para números arbitrários → abuso, custo, blacklist do número.

**Arquivo afetado:**
- `app/backend/routers/notifications.py`

**Referência atual:**
```python
@router.post("/test-send/{phone}")
async def test_send_notification(
    phone: str, current_user: User = Depends(get_current_active_user)
):
```

**Correção (escolher uma):**
- [ ] **Opção A:** Restringir a `get_current_super_admin`
- [ ] **Opção B:** Remover endpoint em produção (`ENABLE_TEST_WHATSAPP=false`)
- [ ] **Opção C:** Remover endpoint completamente após validar WAHA em dev

---

### 4. Forgot-password revela se email existe

**Status:** [x] Implementado (aguardando teste local)

**Problema:** Retornava HTTP 404 se o email não estava cadastrado → atacante descobria quem usa o app (enumeração de emails).

**Correção aplicada:**
- [x] Sempre retorna HTTP 200 com a mesma mensagem genérica
- [x] Não envia email se usuário não existir ou estiver inativo (silencioso)
- [x] Frontend atualizado com texto neutro (não promete envio garantido)

---

## 🟡 Importante — fazer logo após o MVP

### 5. Token longo (720 min = 12h)

**Status:** [ ] Pendente

**Problema:** Token roubado permanece válido por muito tempo.

**Arquivos afetados:**
- `app/backend/config.py` (`access_token_expire_minutes`)
- `app/backend/utils/security.py`
- `app/backend/routers/auth.py`

**Correção:**
- [ ] Access token curto: **15–30 minutos**
- [ ] Refresh token em cookie HttpOnly (7–30 dias)
- [ ] Endpoint `POST /api/auth/refresh`
- [ ] Revogar refresh tokens no logout / troca de senha

---

### 6. Sem headers de segurança no frontend

**Status:** [ ] Pendente

**Problema:** Faltam proteções contra clickjacking, XSS e mixed content.

**Arquivos afetados:**
- `app/frontend/next.config.js`
- Gateway K8s / HTTPRoute (alternativa)

**Correção — adicionar headers:**
- [ ] `Strict-Transport-Security` (HSTS)
- [ ] `X-Frame-Options: DENY` (ou `SAMEORIGIN`)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Content-Security-Policy` (ajustar conforme scripts/fonts usados)
- [ ] `Permissions-Policy` (câmera, microfone, etc.)

---

### 7. CORS com `allow_headers=["*"]`

**Status:** [ ] Pendente

**Problema:** Configuração ampla demais; risco se origens forem mal configuradas no futuro.

**Arquivo afetado:**
- `app/backend/main.py`

**Correção:**
- [ ] Substituir `allow_headers=["*"]` por lista explícita: `Authorization`, `Content-Type`, `Accept`
- [ ] Revisar `expose_headers` — remover `*` se não necessário
- [ ] Manter `allow_origins` restrito (sem wildcard `*` em produção)

---

### 8. Superadmin com acesso total

**Status:** [ ] Pendente

**Problema:** Conta superadmin comprometida = acesso a todas as famílias e dados.

**Correção:**
- [ ] Ativar 2FA na conta superadmin (TOTP)
- [ ] Senha forte e única (gerenciador de senhas)
- [ ] (Opcional) Restringir painel admin por IP fixo / VPN
- [ ] Auditar ações sensíveis do superadmin nos access logs

---

## 🟢 Billing — ao implementar Mercado Pago

### 9. Webhook do Mercado Pago sem validação

**Status:** [ ] Pendente (módulo billing ainda não existe)

**Problema:** Atacante pode enviar POST falso simulando pagamento aprovado e liberar acesso sem pagar.

**Correção:**
- [ ] Validar header `x-signature` com secret configurado no MP
- [ ] Consultar status real na API do MP (`/preapproval`, `/authorized_payments/{id}`)
- [ ] Idempotência: guardar `event_id` processado (evitar replay)
- [ ] Endpoint webhook sem autenticação JWT, mas **com** validação de assinatura MP
- [ ] Retornar HTTP 200 apenas após processamento bem-sucedido

---

### 10. Dados de cartão no servidor

**Status:** [ ] Pendente (módulo billing ainda não existe)

**Problema:** Armazenar número de cartão exige PCI compliance pesado.

**Correção:**
- [ ] Usar CardForm / Checkout MP — tokenização no frontend
- [ ] Backend recebe apenas `card_token_id` e `preapproval_id`
- [ ] **Nunca** persistir número, CVV ou validade do cartão
- [ ] Logs não devem registrar dados sensíveis de pagamento

---

## 🔵 Infraestrutura e manutenção contínua

### 11. Secrets e credenciais

**Status:** [ ] Revisar periodicamente

- [x] `firebase-service-account.json` no `.gitignore`
- [x] Pasta `app/backend/secrets/` no `.gitignore`
- [ ] Confirmar que nenhum secret está no histórico do Git (`git log --all -- "**/secrets/**"`)
- [ ] Rotacionar `SECRET_KEY` JWT se houver suspeita de vazamento
- [ ] Rotacionar credenciais Firebase se arquivo vazar

**Se vazar `firebase-service-account.json`:**
1. Revogar chave no Firebase Console imediatamente
2. Gerar nova service account
3. Atualizar secret no K8s
4. Tratar repositório como comprometido se ficou público

---

### 12. Kubernetes / rede

**Status:** [ ] Pendente

- [ ] NetworkPolicy: MongoDB aceita conexão **somente** do backend
- [ ] MongoDB **sem** exposição pública (somente cluster interno)
- [ ] Limites de CPU/memória nos pods (mitigar DoS por consumo)
- [ ] WAF / Cloudflare na frente do domínio (filtra tráfego malicioso automatizado)

---

### 13. Monitoramento e resposta a incidentes

**Status:** [ ] Pendente

- [ ] Alertas para muitas falhas de login no mesmo IP/email
- [ ] Revisão semanal dos access logs (`/api/admin/access-logs`)
- [ ] Backup MongoDB testado (restore, não só dump)
- [ ] Política de privacidade + termos de uso (LGPD)
- [ ] Atualizar dependências mensalmente (`npm audit`, `pip audit` / Dependabot)

---

## Checklist rápido — ordem sugerida

```
Fase 1 — Antes de vender (🔴 Urgente)
  □ 1. Cookie HttpOnly para JWT
  □ 2. Rate limit no login
  □ 3. Restringir/remover test-send WhatsApp
  □ 4. Forgot-password sem vazar emails

Fase 2 — MVP comercial (🟡 Importante)
  □ 5. Refresh token + access token curto
  □ 6. Headers de segurança
  □ 7. CORS restrito
  □ 8. Proteção superadmin (2FA)

Fase 3 — Billing (🟢)
  □ 9. Webhook MP validado
  □ 10. Sem dados de cartão no servidor

Fase 4 — Contínuo (🔵)
  □ 11–13. Infra, secrets, monitoramento
```

---

## Referências no código

| Item | Arquivo principal |
|------|-------------------|
| Login / JWT | `app/backend/routers/auth.py` |
| Token frontend | `app/frontend/src/services/auth.service.ts` |
| Axios / Bearer | `app/frontend/src/lib/api.ts` |
| Middleware rotas | `app/frontend/middleware.ts` |
| CORS | `app/backend/main.py` |
| Test WhatsApp | `app/backend/routers/notifications.py` |
| Config JWT expiry | `app/backend/config.py` |
| Next.js config | `app/frontend/next.config.js` |

---

*Última revisão: agosto/2026*
