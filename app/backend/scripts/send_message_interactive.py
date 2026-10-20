#!/usr/bin/env python3
"""
Script Flexível para Enviar Mensagem de Teste
Permite testar com diferentes números
"""

from datetime import datetime
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


def send_message(
    phone_number: str,
    base_url: str,
    api_key: str,
    message: str = None,
    user_name: str = "Cliente",
) -> bool:
    """Envia mensagem"""

    # Limpa número
    phone_clean = "".join(c for c in phone_number if c.isdigit())
    if not phone_clean.startswith("55"):
        phone_clean = "55" + phone_clean

    # Formata chat ID para WhatsApp
    chat_id = f"{phone_clean}@c.us"

    # Mensagem padrão se não fornecida
    if not message:
        message = (
            "🧪 *TESTE DO SISTEMA DE NOTIFICAÇÕES*\n\n"
            f"Olá {user_name}!\n"
            "✅ Aviso automático do nosso sistema Controle de Contas.\n\n"
            "Este é um teste do sistema de notificações de contas vencidas.\n\n"
            f"✅ Sistema funcionando corretamente!\n"
            f"⏰ Testado em: {datetime.now().strftime('%d/%m/%Y às %H:%M:%S')}\n\n"
            "Você receberá lembretes automáticos sobre suas contas vencidas.\n\n"
            "Acesse: https://contas.example.com/login"
        )

    print(f"\n📱 Enviando mensagem para: {phone_clean}")
    print(f"📝 Mensagem:\n{message}\n")
    print("⏳ Enviando...\n")

    try:
        url = f"{base_url}/api/sendText"
        headers = {"X-Api-Key": api_key}
        payload = {"chatId": chat_id, "text": message, "session": "default"}

        response = requests.post(url, json=payload, headers=headers, timeout=10)

        if response.status_code in [200, 201]:
            print("✅ SUCESSO!")
            print(f"   Mensagem enviada para: {phone_clean}")
            print("   Você deve receber em poucos segundos\n")
            return True
        else:
            try:
                error = response.json()
                err_msg = error.get("exception", {}).get("message", "Desconhecido")
                print(f"❌ ERRO: {err_msg}")
            except Exception:
                print(f"❌ ERRO STATUS {response.status_code}: {response.text[:200]}")
            print()
            return False

    except Exception as e:
        print(f"❌ ERRO: {e}\n")
        return False


if __name__ == "__main__":
    print("=" * 70)
    print("  📨 ENVIAR MENSAGEM DE TESTE FLEXÍVEL")
    print("=" * 70)
    print()

    env = load_env()

    if not env:
        print("❌ Arquivo .env não encontrado!")
        exit(1)

    base_url = env.get("WAHA_BASE_URL")
    api_key = env.get("WAHA_API_KEY")

    if not base_url or not api_key:
        print("❌ Variáveis WAHA_BASE_URL ou WAHA_API_KEY não configuradas!")
        exit(1)

    print("""
📋 OPÇÕES DE TESTE:

  1. Enviar para 48991817627 (seu número)
  2. Enviar para outro número (digite manualmente)
  3. Ver informações da sessão
  4. Sair

    """)

    choice = input("Escolha uma opção (1-4): ").strip()

    if choice == "1":
        print()
        user_name = (
            input("👤 Nome do usuário (ENTER para 'Cliente'): ").strip() or "Cliente"
        )
        success = send_message("48991817627", base_url, api_key, user_name=user_name)

        if not success:
            print("""
⚠️  Se recebeu erro "No LID for user":
   1. Abra WhatsApp no seu celular
   2. Certifique-se que 48991817627 está nos contatos
   3. Aguarde 1-2 minutos de sincronização
   4. Tente novamente
            """)

    elif choice == "2":
        phone = input("\n📱 Digite o número (com ou sem código 55): ").strip()
        if phone:
            user_name = (
                input("👤 Nome do usuário (ENTER para 'Cliente'): ").strip()
                or "Cliente"
            )
            success = send_message(phone, base_url, api_key, user_name=user_name)
        else:
            print("❌ Número não fornecido")

    elif choice == "3":
        print()
        try:
            response = requests.get(
                f"{base_url}/api/sessions", headers={"X-Api-Key": api_key}, timeout=10
            )

            if response.status_code == 200:
                sessions = response.json()
                print("📊 INFORMAÇÕES DA SESSÃO:\n")
                for session in sessions:
                    print(f"  Nome: {session.get('name')}")
                    print(f"  Status: {session.get('status')}")
                    me = session.get("me", {})
                    phone_id = me.get("id", "").split("@")[0] if me.get("id") else "N/A"
                    print(f"  Seu Número: +{phone_id}")
                    print(f"  Nome (Push): {me.get('pushName', 'N/A')}")
                    print()
            else:
                print(f"❌ Erro ao buscar sessões: {response.status_code}")

        except Exception as e:
            print(f"❌ Erro: {e}")

    elif choice == "4":
        print("👋 Saindo...")
        exit(0)

    else:
        print("❌ Opção inválida")
        exit(1)
