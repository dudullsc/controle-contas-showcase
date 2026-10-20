#!/usr/bin/env python3
"""
Script para Enviar Notificações de Contas do MÊS ATUAL
Envia para TODOS os usuários com telefone cadastrado no MongoDB
"""

import asyncio
import os
import socket
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

# Lógica de conexão inteligente: tenta o DNS do Kubernetes, se falhar usa localhost


def get_mongo_url():
    env_url = os.getenv("MONGODB_URL", "mongodb://mongo-service:27017")
    try:
        # Tenta resolver o nome do serviço do Kubernetes
        socket.gethostbyname("mongo-service")
        return env_url
    except socket.gaierror:
        # Se falhar (rodando manual fora do cluster), usa localhost
        return "mongodb://localhost:27017"


async def main():
    print("=" * 80)
    print(" " * 15 + "📤 ENVIAR NOTIFICAÇÕES GERAIS - MÊS ATUAL")
    print("=" * 80)
    print()

    # Conecta ao MongoDB usando a URL inteligente
    target_url = get_mongo_url()
    print(f"🔗 Conectando ao banco em: {target_url}")
    mongo_client = AsyncIOMotorClient(target_url)
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

        # Busca TODOS os usuários que possuem telefone no banco
        user_collection = db["users"]
        users = await user_collection.find(
            {"phone": {"$exists": True, "$ne": ""}}
        ).to_list(None)

        print(f"👥 Encontrados {len(users)} usuários para processar\n")

        expense_collection = db["expenses"]
        total_notificacoes = 0

        for user in users:
            user_id = str(user["_id"])
            user_name = user.get("full_name", "Cliente")
            user_phone = user.get("phone")

            print(f"👤 Processando: {user_name} ({user_phone})")

            # Busca despesas deste usuário
            expenses = await expense_collection.find({"user_id": user_id}).to_list(None)
            contas_mes_atual = []

            for expense in expenses:
                due_date = expense.get("due_date")
                if not due_date:
                    continue

                if hasattr(due_date, "replace"):
                    due_date = due_date.replace(tzinfo=None)

                if due_date.month == mes_atual and due_date.year == ano_atual:
                    contas_mes_atual.append(expense)

            if not contas_mes_atual:
                print("   ℹ️ Nenhuma conta para este mês.\n")
                continue

            # Processa as contas filtradas
            for expense in contas_mes_atual:
                due_date = expense.get("due_date").replace(tzinfo=None)
                days_diff = (due_date.date() - hoje.date()).days
                desc = expense.get("description", "Conta")
                amount = expense.get("amount", 0)
                status = expense.get("status", "pendente")

                # Só envia para contas em aberto
                if status.upper() not in {"EM ABERTO", "NÃO PAGO"}:
                    continue

                # Lógica de disparo baseada nos dias
                success = False
                if days_diff < 0:
                    success, _ = notification_service.send_notification_expense_overdue(
                        phone_number=user_phone,
                        user_name=user_name,
                        expense_description=desc,
                        amount=amount,
                        due_date=due_date,
                        days_overdue=abs(days_diff),
                    )
                elif days_diff == 0:
                    success, _ = notification_service.send_notification_expense_overdue(
                        phone_number=user_phone,
                        user_name=user_name,
                        expense_description=desc,
                        amount=amount,
                        due_date=due_date,
                        days_overdue=0,
                    )
                elif days_diff == 1:
                    success, _ = (
                        notification_service.send_notification_expense_1_day_before(
                            phone_number=user_phone,
                            user_name=user_name,
                            expense_description=desc,
                            amount=amount,
                            due_date=due_date,
                        )
                    )
                elif days_diff == 5:
                    success, _ = (
                        notification_service.send_notification_expense_5_days_before(
                            phone_number=user_phone,
                            user_name=user_name,
                            expense_description=desc,
                            amount=amount,
                            due_date=due_date,
                        )
                    )

                if success:
                    print(f"   ✅ Notificado: {desc} (R$ {amount:,.2f})")
                    total_notificacoes += 1
                    # Delay pequeno entre mensagens para evitar bloqueio do WhatsApp
                    await asyncio.sleep(2)

        print("\n" + "=" * 80)
        print(f"✅ FINALIZADO: {total_notificacoes} notificações enviadas.")
        print("=" * 80)

    finally:
        mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
