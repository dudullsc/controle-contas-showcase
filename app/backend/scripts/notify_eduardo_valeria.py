#!/usr/bin/env python3
"""
Script para Enviar Notificações de Contas do MÊS ATUAL
Para Eduardo Lopes e Valeria Ribeiro
Apenas contas do mês atual (fevereiro/2026)
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
    print(" " * 15 + "📤 ENVIAR NOTIFICAÇÕES - CONTAS DO MÊS ATUAL")
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

        # Pega o mês e ano atual
        hoje = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        mes_atual = hoje.month
        ano_atual = hoje.year

        print(f"📅 Filtrando contas de: {mes_atual:02d}/{ano_atual}\n")

        # Busca os usuários
        user_collection = db["users"]
        usuarios_alvo = ["Eduardo Lopes", "Valeria Ribeiro"]

        users = await user_collection.find(
            {"full_name": {"$in": usuarios_alvo}}
        ).to_list(None)

        print(f"👥 Encontrados {len(users)} usuários\n")

        # Para cada usuário
        expense_collection = db["expenses"]
        total_notificacoes = 0

        for user in users:
            user_id = str(user["_id"])
            user_name = user.get("full_name", "Desconhecido")
            user_phone = user.get("phone")

            if not user_phone:
                print(f"⚠️  {user_name}: Sem telefone configurado")
                continue

            print(f"👤 {user_name}")
            print(f"   Telefone: {user_phone}\n")

            # Busca TODAS as despesas deste usuário
            expenses = await expense_collection.find({"user_id": user_id}).to_list(None)

            print(f"   📊 Total de contas: {len(expenses)}")

            # Filtra contas do mês atual
            contas_mes_atual = []

            for expense in expenses:
                if not expense.get("due_date"):
                    continue

                due_date = expense.get("due_date")
                if hasattr(due_date, "replace"):
                    due_date = due_date.replace(tzinfo=None)

                # Verifica se é do mês atual
                if due_date.month == mes_atual and due_date.year == ano_atual:
                    contas_mes_atual.append(expense)

            print(f"   ⚡ Contas do mês atual: {len(contas_mes_atual)}\n")

            # Processa contas do mês
            for expense in contas_mes_atual:
                if not expense.get("due_date"):
                    continue

                due_date = expense.get("due_date")
                if hasattr(due_date, "replace"):
                    due_date = due_date.replace(tzinfo=None)

                # Calcula diferença
                days_diff = (due_date.date() - hoje.date()).days

                desc = expense.get("description", "Conta sem descrição")
                amount = expense.get("amount", 0)
                status = expense.get("status", "pendente")

                print(f"      💰 {desc}")
                print(f"         Valor: R$ {amount:,.2f}")
                print(f"         Vencimento: {due_date.strftime('%d/%m/%Y')}")
                print(f"         Status: {status}")
                print("         ", end="")

                # So envia para contas em aberto/nao pagas
                if status not in {"EM ABERTO", "NÃO PAGO"}:
                    print(f"⏭️  Ignorado (status {status})")
                    print()
                    continue

                notificacao_enviada = False

                # Vencida
                if days_diff < 0:
                    dias_atraso = abs(days_diff)
                    print(f"🔴 {dias_atraso} dia(s) em atraso")

                    success, msg = (
                        notification_service.send_notification_expense_overdue(
                            phone_number=user_phone,
                            user_name=user_name,
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

                # Vence hoje
                elif days_diff == 0:
                    print("🔴 VENCE HOJE")

                    success, msg = (
                        notification_service.send_notification_expense_overdue(
                            phone_number=user_phone,
                            user_name=user_name,
                            expense_description=desc,
                            amount=amount,
                            due_date=due_date,
                            days_overdue=0,
                        )
                    )
                    if success:
                        print("         ✅ Notificação enviada!")
                        total_notificacoes += 1
                        notificacao_enviada = True

                # Vence amanhã
                elif days_diff == 1:
                    print("🟠 VENCE AMANHÃ")

                    success, msg = (
                        notification_service.send_notification_expense_1_day_before(
                            phone_number=user_phone,
                            user_name=user_name,
                            expense_description=desc,
                            amount=amount,
                            due_date=due_date,
                        )
                    )
                    if success:
                        print("         ✅ Notificação enviada!")
                        total_notificacoes += 1
                        notificacao_enviada = True

                # Vence em 5 dias
                elif days_diff == 5:
                    print("🟡 VENCE EM 5 DIAS")

                    success, msg = (
                        notification_service.send_notification_expense_5_days_before(
                            phone_number=user_phone,
                            user_name=user_name,
                            expense_description=desc,
                            amount=amount,
                            due_date=due_date,
                        )
                    )
                    if success:
                        print("         ✅ Notificação enviada!")
                        total_notificacoes += 1
                        notificacao_enviada = True

                # Outros dias
                else:
                    if days_diff > 0:
                        print(f"📅 VENCE EM {days_diff} DIAS")
                    else:
                        print(f"📅 {abs(days_diff)} dias atrás")

                if not notificacao_enviada:
                    print()
                else:
                    print()

            print()

        print("=" * 80)
        print(f"\n✅ RESUMO: {total_notificacoes} notificação(ões) enviada(s)\n")
        print("=" * 80)

    finally:
        mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
