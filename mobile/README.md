# Controle de Contas — App Mobile (Capacitor)

Shell Android/iOS que abre o site em produção dentro do app e agenda **notificações locais** de contas atrasadas e a vencer.

## Como funciona

1. O APK abre **direto** `https://contas.example.com` no WebView (sem iframe).
2. Qualquer deploy do frontend via Git/CI atualiza o que o usuário vê **sem reinstalar o APK**.
3. O `MainActivity` pede permissão de notificação na 1ª abertura e injeta o bridge que escuta `postMessage` do site (`scheduleNotifications` / `cancelNotifications`).
4. Cookies/JWT ficam first-party no WebView — o login redireciona normalmente para o dashboard.

> Evitamos iframe de propósito: com iframe o cookie `SameSite=Lax` não ia no middleware do Next.js e o app ficava “logado” na tela de login.

## Pré-requisitos

- Node.js 18+
- Android Studio + SDK (caminho típico: `%LOCALAPPDATA%\Android\Sdk`)
- JDK 17+

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
```

## Setup

```bash
cd mobile
npm install
npx cap sync android
```

## Gerar APK com bump de versão (recomendado)

Na raiz do repo (ou via npm no `mobile/`):

```powershell
# patch 1.0.11 -> 1.0.12, versionCode +1, cap sync, assembleRelease
.\scripts\build-apk.ps1

# ou
cd mobile
npm run release:apk
```

Opções úteis:

```powershell
.\scripts\build-apk.ps1 -Bump minor          # 1.0.x -> 1.1.0
.\scripts\build-apk.ps1 -Version 1.0.12      # versão explícita
.\scripts\build-apk.ps1 -SkipBump            # só builda a versão atual
.\scripts\build-apk.ps1 -DebugBuild             # APK debug
```

Copia o APK para `mobile/controle-contas-<versão>.apk` (já no `.gitignore`).

O script chama `scripts/bump-version.ps1` (frontend, backend, Android, iOS, k8s).

## Gerar APK (debug, sem bump)

```powershell
cd mobile
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
npm run build:apk
```

APK gerado em:

`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

Ou abra no Android Studio:

```bash
npm run open:android
```

## iOS

O projeto iOS pode ser gerado com `npx cap add ios` (build do IPA exige Mac + Xcode).

## Notificações

| Situação | Canal | Comportamento |
|----------|-------|----------------|
| App aberto / recentemente usado | Local Notifications | (desativado — evita duplicar FCM) |
| App fechado (estilo Nubank) | **FCM push** | Backend envia pelo scheduler diário para o token do aparelho |
| Contas atrasadas | FCM + WhatsApp | **1× por dia** com total de dias em atraso (até 30 dias) |
| WhatsApp | WAHA | Independente — só se usuário tiver telefone e WAHA ativo |

Ícone da notificação Android: `drawable/ic_stat_contas` (branco monocromático + cor `#0D9488`).

### Push FCM (app fechado) — setup Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e adicione o app Android com package `com.dudullsc.controlecontas`.
2. Baixe `google-services.json` e coloque em:
   `mobile/android/app/google-services.json`
3. Em **Project settings → Service accounts**, gere uma chave JSON da service account.
4. No backend (prod), defina uma destas:
   - `FCM_CREDENTIALS_FILE=/caminho/para/service-account.json`
   - ou `FCM_CREDENTIALS_JSON='{"type":"service_account",...}'`
5. Rebuild do APK + deploy do backend.

Sem o `google-services.json`, o Gradle avisa e o push remoto **não** funciona (local notifications seguem ok).

API do token (após login no app): `POST /cc-api/devices/fcm-token`

WhatsApp no backend continua independente deste canal.

## APK release (assinado — menos avisos de segurança)

O APK **debug** usa chave de desenvolvimento e costuma gerar alertas do Play Protect / “app inseguro”.

Use o **release** assinado:

1. Confirme `mobile/android/keystore.properties` (veja o `.example`).
2. Gere o APK:

```powershell
cd mobile
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm run build:apk:release
```

Saída:

`mobile/android/app/build/outputs/apk/release/app-release.apk`

**Importante:** desinstale o APK debug antes (assinaturas diferentes). Guarde o arquivo `.jks` — sem ele não dá para atualizar o app no futuro com a mesma assinatura.

Instalação fora da Play Store ainda pede “instalar apps desconhecidos” uma vez; isso é do Android, não do APK.

## Biometria

1. Faça login com e-mail/senha no app.
2. Aceite ativar digital / Face ID quando o app perguntar.
3. Nas próximas aberturas, use **Entrar com biometria** na tela de login.

Credenciais ficam no Keystore do Android (protegidas pela biometria). Rebuild do APK é necessário após mudar plugins nativos.

## Compartilhar comprovante (Android)

No Android, o app aparece no menu **Compartilhar** de PDFs e imagens:

1. Abra o comprovante (banco, WhatsApp, Arquivos, etc.) e toque em **Compartilhar**.
2. Escolha **Controle de Contas**.
3. O app abre a tela de **Despesas**; toque em **Anexar** na conta desejada.

Tipos aceitos: JPG, PNG, WEBP, PDF (até 5 MB). Requer APK novo (intent no `AndroidManifest` + `MainActivity`) e frontend com o seletor de contas.
