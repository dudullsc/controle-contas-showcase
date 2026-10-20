#!/usr/bin/env python3
"""
Script para Diagnosticar Problema de Sincronização de Contatos
"""

from pathlib import Path

import requests


def load_env():
    """Carrega variáveis do .env"""
    env_file = Path(__file__).parent / ".env"
    env = {}

    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env[key.strip()] = value.strip()

    return env


def check_session_details(base_url: str, api_key: str):
    """Verifica detalhes da sessão"""
    try:
        url = f"{base_url}/api/sessions"
        headers = {"X-Api-Key": api_key}

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            sessions = response.json()

            print("\n📊 DETALHES DAS SESSÕES ATIVAS:\n")

            if isinstance(sessions, list) and sessions:
                for session in sessions:
                    print(f"  Sessão: {session.get('sessionName', 'N/A')}")
                    print(f"  Status: {session.get('status', 'N/A')}")
                    print(f"  Telefone: {session.get('phoneNumber', 'N/A')}")
                    conn_status = session.get("connectionStatus", "N/A")
                    print(f"  Qualidade da conexão: {conn_status}")
                    needs_qr = session.get("needsQRCode", False)
                    print(f"  Precisa de código QR: {needs_qr}")
                    print(f"  Webhook: {session.get('webhookUrl', 'N/A')}")
                    print()

                    if session.get("needsQRCode"):
                        print(
                            "  ⚠️  ATENÇÃO: Session precisa ser reescaneada via QR Code!"
                        )
                        print("     Acesse: https://botzap.example.com")
            else:
                print("  Nenhuma sessão ativa encontrada")

            return True
    except Exception as e:
        print(f"  ❌ Erro ao buscar sessões: {str(e)}")
        return False


def test_get_chats(base_url: str, api_key: str):
    """Tenta listar os chats/contatos disponíveis"""
    try:
        url = f"{base_url}/api/chats"
        headers = {"X-Api-Key": api_key}

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            chats = response.json()

            print("\n📋 CHATS/CONTATOS DISPONÍVEIS:\n")

            if isinstance(chats, list):
                print(f"  Total de chats: {len(chats)}\n")

                # Mostra apenas alguns (primeiros 10)
                for i, chat in enumerate(chats[:10]):
                    name = chat.get("name", "Sem nome")
                    chat_id = chat.get("id", "N/A")
                    print(f"  {i + 1}. {name}")
                    print(f"     ID: {chat_id}\n")

                if len(chats) > 10:
                    print(f"  ... e mais {len(chats) - 10} chats\n")

                # Procura pelo número
                numero_busca = "48991817627"
                encontrado = False

                print(f"  🔍 Procurando por '{numero_busca}'...")
                for chat in chats:
                    chat_id = chat.get("id", "")
                    if numero_busca in chat_id:
                        print(f"  ✅ ENCONTRADO: {chat.get('name', 'N/A')}")
                        print(f"     Chat ID: {chat_id}")
                        encontrado = True
                        break

                if not encontrado:
                    print(f"\n  ❌ Número '{numero_busca}' não encontrado")
                    print("      (nos contatos sincronizados)")
                    print("\n  SOLUÇÃO:")
                    print("  1. Abra o WhatsApp Web (https://web.whatsapp.com)")
                    print("  2. Procure pelo contato")
                    print("     '+55 48 99181-7627' ou '48991817627'")
                    print("  3. Certifique-se que está nos contatos")
                    print("     (não em 'chats antigos')")
                    print("  4. Espere 1-2 minutos para sincronização")
                    print("  5. Se ainda não aparecer, clique no contato")
                    print("     para abrir chat")
                    print("  6. Volte aqui e tente novamente")

            return True
    except Exception as e:
        print(f"  ❌ Erro ao buscar chats: {str(e)}")
        return False


if __name__ == "__main__":
    print("=" * 70)
    print("  🔍 DIAGNÓSTICO DE SINCRONIZAÇÃO DE CONTATOS")
    print("=" * 70)

    env = load_env()

    if not env:
        print("\n❌ Arquivo .env não encontrado!")
        exit(1)

    base_url = env.get("WAHA_BASE_URL")
    api_key = env.get("WAHA_API_KEY")

    if not base_url or not api_key:
        print("\n❌ Variáveis WAHA não configuradas!")
        exit(1)

    print(f"\n  Base URL: {base_url}")
    print(f"  API Key: {api_key[:20]}...")

    # Verifica sessão
    check_session_details(base_url, api_key)

    # Tenta listar chats
    test_get_chats(base_url, api_key)

    print("\n" + "=" * 70)
    print("\n  PRÓXIMOS PASSOS:")
    print("\n  1. Se a sessão mostra 'needsQRCode: true':")
    print("     → Acesse https://botzap.example.com e rescaneie o QR")
    print("\n  2. Se o contato NÃO aparece nos chats:")
    print("     → Abra WhatsApp Web e clique no contato para sincronizar")
    print("\n  3. Depois execute novamente:")
    print("     → python test_notifications_report.py")
    print("     → python send_test_message.py")
    print("\n" + "=" * 70 + "\n")
