"""
Script de Diagnóstico de Telefones
Verifica se todos os telefones no banco estão no formato correto para A API WhatsApp
NÃO modifica o banco, apenas relata problemas
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import settings
from utils.formatting import normalize_phone_for_whatsapp


async def check_phones():
    """
    Verifica todos os telefones sem modificar nada
    """
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    print("\n" + "=" * 70)
    print("📱 DIAGNÓSTICO DE TELEFONES - WhatsApp API")
    print("=" * 70)
    print(f"⏰ Data/Hora: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"📦 Banco: {settings.database_name}")
    print("=" * 70 + "\n")

    try:
        users = await db.users.find({}).to_list(None)
        print(f"📊 Total de usuários: {len(users)}\n")

        # Categorias
        ok = []
        no_phone = []
        invalid = []
        needs_format = []

        for user in users:
            user_id = str(user.get("_id"))
            user_name = user.get("full_name", "Desconhecido")
            user_email = user.get("email", "N/A")
            phone = user.get("phone")

            if not phone:
                no_phone.append({"name": user_name, "id": user_id, "email": user_email})
                continue

            phone_normalized = normalize_phone_for_whatsapp(phone)

            if not phone_normalized:
                invalid.append(
                    {
                        "name": user_name,
                        "id": user_id,
                        "email": user_email,
                        "phone": phone,
                    }
                )
            elif phone != phone_normalized:
                needs_format.append(
                    {
                        "name": user_name,
                        "id": user_id,
                        "email": user_email,
                        "current": phone,
                        "correct": phone_normalized,
                    }
                )
            else:
                ok.append({"name": user_name, "id": user_id, "phone": phone})

        # Relatório
        print("┌" + "─" * 68 + "┐")
        print(f"│ ✅ TELEFONES CORRETOS: {len(ok)}")
        print("└" + "─" * 68 + "┘")
        if ok:
            for user in ok:
                print(f"  ✓ {user['name']:<25} | {user['phone']:<15} | {user['id']}")
        print()

        print("┌" + "─" * 68 + "┐")
        print(f"│ ⚠️  SEM TELEFONE: {len(no_phone)}")
        print("└" + "─" * 68 + "┘")
        if no_phone:
            for user in no_phone:
                print(f"  ✗ {user['name']:<25} | {user['email']:<20} | {user['id']}")
        print()

        print("┌" + "─" * 68 + "┐")
        print(f"│ 🔧 PRECISA FORMATAÇÃO: {len(needs_format)}")
        print("└" + "─" * 68 + "┘")
        if needs_format:
            for user in needs_format:
                print(f"  ⟲ {user['name']:<25}")
                print(f"    Atual : {user['current']}")
                print(f"    Certo : {user['correct']}")
        print()

        print("┌" + "─" * 68 + "┐")
        print(f"│ ❌ TELEFONES INVÁLIDOS: {len(invalid)}")
        print("└" + "─" * 68 + "┘")
        if invalid:
            for user in invalid:
                print(f"  ✗ {user['name']:<25} | {user['phone']:<20} | {user['id']}")
        print()

        # Resumo Final
        print("=" * 70)
        print("📋 RESUMO FINAL")
        print("=" * 70)
        print(f"✅ Prontos para API: {len(ok)}")
        print(f"⚠️  Sem telefone: {len(no_phone)}")
        print(f"🔧 Precisa ajuste: {len(needs_format)}")
        print(f"❌ Inválidos: {len(invalid)}")
        print(f"📊 Total: {len(users)}")
        print("=" * 70)

        # Status geral
        if len(invalid) > 0 or len(no_phone) > 0:
            print("\n🚨 PROBLEMAS DETECTADOS!")
            if len(invalid) > 0:
                print(
                    f"   ❌ {len(invalid)} telefone(s) inválido(s) - precisa corrigir manualmente"
                )
            if len(no_phone) > 0:
                print(
                    f"   ⚠️  {len(no_phone)} usuário(s) sem telefone - não receberá notificações"
                )
            print(
                "\n💡 Dica: Use 'python scripts/normalize_phones.py' para fixar automaticamente"
            )
            return False
        else:
            print("\n✅ TUDO OK! Todos os telefones estão corretos para a API WhatsApp")
            return True

    except Exception as e:
        print(f"\n❌ ERRO: {e}")
        import traceback

        traceback.print_exc()
        return False

    finally:
        client.close()


if __name__ == "__main__":
    success = asyncio.run(check_phones())
    sys.exit(0 if success else 1)
