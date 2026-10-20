#!/usr/bin/env python3
"""
Script para Verificar o Banco e Enviar Notificações Reais
Check em todas as despesas vencidas/expirando e manda notificações
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.whatsapp_notification import WhatsAppNotificationService

# Carrega .env
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")


async def main():
    print("=" * 80)
    print(" " * 15 + "📊 VERIFICAR BANCO E ENVIAR NOTIFICAÇÕES REAIS")
    print("=" * 80)
    print()

    # Conecta ao MongoDB
    mongo_client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = mongo_client["controle_contas"]

    try:
        # Inicializa o serviço de notificações
        notification_service = WhatsAppNotificationService()
        is_connected, msg = notification_service.test_connection()

        if not is_connected:
            print(f"❌ Erro ao conectar ao WAHA: {msg}")
            return

        print("✅ Conexão com WAHA: OK\n")

        # Busca todos os usuários
        user_collection = db["users"]
        users = await user_collection.find({}).to_list(None)

        print(f"👥 Total de usuários encontrados: {len(users)}\n")

        # Para cada usuário, verifica despesas
        expense_collection = db["expenses"]

        total_notificacoes = 0

        for user in users:
            user_id = str(user["_id"])
            user_name = user.get("full_name", "Desconhecido")
            user_phone = user.get("phone")

            if not user_phone:
                print(f"⚠️  {user_name}: Sem telefone configurado")
                continue

            print(f"👤 Verificando: {user_name}")
            print(f"   Telefone: {user_phone}")

            # Busca despesas deste usuário
            expenses = await expense_collection.find(
                {
                    "user_id": user_id,
                    "status": "pending",  # Apenas contas não pagas
                }
            ).to_list(None)

            print(f"   Despesas pendentes: {len(expenses)}\n")

            hoje = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

            # Verifica cada despesa
            for expense in expenses:
                desc = expense.get("description", "Sem descrição")
                amount = expense.get("amount", 0)
                due_date = expense.get("due_date")

                if not due_date:
                    continue

                # Remove timezone se houver
                if hasattr(due_date, "replace"):
                    due_date = due_date.replace(tzinfo=None)

                # Calcula diferença em dias
                days_diff = (due_date.date() - hoje.date()).days

                print(f"      💰 {desc}")
                print(f"         Valor: R$ {amount:,.2f}")
                print(f"         Vencimento: {due_date.strftime('%d/%m/%Y')}")
                print("         Status: ", end="")

                notificacao_enviada = False

                # 5 dias antes
                if days_diff == 5:
                    print("⏰ Vence em 5 dias")
                    success, msg = (
                        notification_service.send_notification_expense_5_days_before(
                            phone_number=user_phone,
                            expense_description=desc,
                            amount=amount,
                            due_date=due_date,
                        )
                    )
                    if success:
                        print("         ✅ Notificação enviada!")
                        total_notificacoes += 1
                        notificacao_enviada = True

                # 1 dia antes
                elif days_diff == 1:
                    print("⏰ Vence amanhã")
                    success, msg = (
                        notification_service.send_notification_expense_1_day_before(
                            phone_number=user_phone,
                            expense_description=desc,
                            amount=amount,
                            due_date=due_date,
                        )
                    )
                    if success:
                        print("         ✅ Notificação enviada!")
                        total_notificacoes += 1
                        notificacao_enviada = True

                # Vencida
                elif days_diff <= 0:
                    dias_atraso = abs(days_diff)
                    if dias_atraso == 0:
                        print("🔴 Vence hoje")
                    else:
                        print(f"🔴 {dias_atraso} dia(s) em atraso")

                    success, msg = (
                        notification_service.send_notification_expense_overdue(
                            phone_number=user_phone,
                            expense_description=desc,
                            amount=amount,
                            due_date=due_date,
                            days_overdue=dias_atraso,
                        )
                    )
                    if success:
                        print("         ✅ Notificação enviada!")
                        total_notificacoes += 1
                        notificacao_enviada = True

                # Outras datas
                else:
                    print(f"📅 {days_diff} dias")

                if not notificacao_enviada:
                    print()
                else:
                    print()

        print("=" * 80)
        print(f"\n✅ RESUMO: {total_notificacoes} notificação(ões) enviada(s)\n")
        print("=" * 80)

    finally:
        mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
