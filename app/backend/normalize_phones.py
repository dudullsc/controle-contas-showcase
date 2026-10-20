#!/usr/bin/env python3
"""
Script para Normalizar Números de Telefone no Banco
Converte todos para o formato 55XXXXXXXXXXX
"""

import asyncio
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Carrega .env
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")


def normalizar_telefone(telefone: str) -> str:
    """
    Normaliza número para formato 55XXXXXXXXXXX

    Aceita formatos como:
    - (48) 99181-7627 → 554891817627
    - 48991817627 → 554891817627
    - 48984471009 → 554884471009
    - etc
    """
    if not telefone:
        return None

    # Remove todos os caracteres não numéricos
    apenas_numeros = re.sub(r"\D", "", telefone)

    if not apenas_numeros:
        return None

    # Se tem 11 dígitos (sem 55), remove o 0 do início se houver
    if len(apenas_numeros) == 11:
        # Formato: 0 + DDD + NNNNNNNNN (remove o 0)
        apenas_numeros = apenas_numeros[1:]

    # Se tem 10 dígitos, é só DDD + NNNNNNNNN
    if len(apenas_numeros) == 10:
        # Adiciona 55 na frente
        apenas_numeros = "55" + apenas_numeros

    # Se já tem 12 dígitos (55 + 10), deixa como está
    if len(apenas_numeros) == 12 and apenas_numeros.startswith("55"):
        return apenas_numeros

    return apenas_numeros


async def main():
    print("=" * 80)
    print(" " * 20 + "📞 NORMALIZAR NÚMEROS DE TELEFONE")
    print("=" * 80)
    print()

    # Conecta ao MongoDB
    mongo_client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = mongo_client["controle_contas"]

    try:
        user_collection = db["users"]

        # Busca todos os usuários
        users = await user_collection.find({}).to_list(None)

        print(f"👥 Encontrados {len(users)} usuários\n")

        atualizados = 0

        for user in users:
            telefone_antigo = user.get("phone")

            if not telefone_antigo:
                print(f"⏭️  {user['full_name']}: Sem telefone")
                continue

            # Normaliza
            telefone_novo = normalizar_telefone(telefone_antigo)

            if telefone_novo == telefone_antigo:
                print(f"✅ {user['full_name']}: Já está correto")
                print(f"   {telefone_novo}\n")
                continue

            # Atualiza no banco
            await user_collection.update_one(
                {"_id": user["_id"]}, {"$set": {"phone": telefone_novo}}
            )

            print(f"🔄 {user['full_name']}")
            print(f"   Antes: {telefone_antigo}")
            print(f"   Depois: {telefone_novo}\n")

            atualizados += 1

        print("=" * 80)
        print(f"\n✅ {atualizados} usuário(s) atualizado(s)\n")
        print("=" * 80)

    finally:
        mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
