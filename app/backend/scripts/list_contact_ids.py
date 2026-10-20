#!/usr/bin/env python3
"""
Script para Diagnosticar IDs dos Contatos no WAHA
Mostra o ID exato de cada contato para usar no envio
"""

from pathlib import Path

import requests


def load_env():
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


if __name__ == "__main__":
    print("=" * 70)
    print("  📱 LISTAR IDs DOS CONTATOS NO WAHA")
    print("=" * 70)
    print()

    env = load_env()
    base_url = env.get("WAHA_BASE_URL")
    api_key = env.get("WAHA_API_KEY")

    if not base_url or not api_key:
        print("❌ Variáveis WAHA não configuradas!")
        exit(1)

    print("🔍 Buscando contatos...")
    print()

    try:
        url = f"{base_url}/api/chats"
        headers = {"X-Api-Key": api_key}

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            chats = response.json()

            print(f"✅ Total de chats encontrados: {len(chats)}\n")

            # Procura pelos contatos relevantes
            for chat in chats:
                chat_id = chat.get("id", "")
                name = chat.get("name", "Sem nome")

                # Filtra para mostrar apenas contatos (não grupos)
                if "@c.us" in chat_id and "pescad" in name.lower():
                    print(f"📌 Encontrado: {name}")
                    print(f"   Chat ID: {chat_id}")
                    print(f"   Número extraído: {chat_id.replace('@c.us', '')}")
                    print()

            # Também lista alguns contatos para referência
            print("\n📋 PRIMEIROS 15 CONTATOS (para referência):\n")

            for i, chat in enumerate(chats[:15]):
                chat_id = chat.get("id", "N/A")
                name = chat.get("name", "N/A")
                is_group = "@g.us" in chat_id

                tipo = "GRUPO" if is_group else "CONTATO"
                print(f"{i + 1}. [{tipo}] {name}")
                print(f"   ID: {chat_id}\n")

        else:
            print(f"❌ Erro ao buscar chats: {response.status_code}")
            print(response.text)

    except Exception as e:
        print(f"❌ Erro: {str(e)}")

    print("=" * 70)
