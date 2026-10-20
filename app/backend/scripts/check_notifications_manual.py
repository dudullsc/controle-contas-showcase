#!/usr/bin/env python3
"""
Script de Teste - Notificações WhatsApp
Valida a configuração e testa o envio de mensagens
"""

import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Adiciona o diretório do backend ao path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import settings  # noqa: E402
from services.whatsapp_notification import WhatsAppNotificationService  # noqa: E402


async def print_section(title: str):
    """Imprime seção formatada"""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


async def test_environment():
    """Testa configuração de ambiente"""
    await print_section("1️⃣  VERIFICANDO CONFIGURAÇÕES")

    config_checks = {
        "Notificações Habilitadas": settings.enable_notifications,
        "WAHA URL": settings.waha_base_url,
        "WAHA API Key": "✅ Configurada"
        if settings.waha_api_key
        else "❌ NÃO CONFIGURADA",
        "Hora de Verificação": settings.notification_check_time,
    }

    for key, value in config_checks.items():
        status = "✅" if value and value != "❌ NÃO CONFIGURADA" else "⚠️"
        print(f"{status} {key}: {value}")

    if not settings.enable_notifications:
        print("\n⚠️  Notificações desativadas em config.py")
        return False

    if not settings.waha_api_key:
        print("\n❌ ERRO: WAHA_API_KEY não configurada no .env")
        return False

    print("\n✅ Configuração OK!")
    return True


async def test_connection():
    """Testa conexão com API WAHA"""
    await print_section("2️⃣  TESTANDO CONEXÃO COM WAHA")

    whatsapp = WhatsAppNotificationService(
        base_url=settings.waha_base_url, api_key=settings.waha_api_key
    )

    success, message = whatsapp.test_connection()

    if success:
        print(f"✅ {message}")
        return True
    else:
        print(f"❌ {message}")
        return False


async def test_send_message(phone: str = None) -> bool:
    """Testa envio de mensagem de teste"""
    if not phone:
        phone = input(
            "\n📱 Digite o número de WhatsApp para teste (ex: 5521988776633): "
        ).strip()

    if not phone:
        print("❌ Nenhum número fornecido")
        return False

    # Limpa número
    phone_clean = "".join(c for c in phone if c.isdigit())
    if not phone_clean.startswith("55"):
        phone_clean = "55" + phone_clean

    await print_section("3️⃣  ENVIANDO MENSAGEM DE TESTE")

    print(f"📱 Destino: {phone_clean}\n")

    whatsapp = WhatsAppNotificationService(
        base_url=settings.waha_base_url, api_key=settings.waha_api_key
    )

    message_test = (
        "🧪 *TESTE DO SISTEMA DE NOTIFICAÇÕES*\n\n"
        "Se você recebeu esta mensagem, o sistema está funcionando! ✅\n\n"
        f"Enviada em: {datetime.now().strftime('%d/%m/%Y às %H:%M:%S')}"
    )

    print("📝 Mensagem:")
    print(message_test)
    print("\n⏳ Enviando...")

    success, result = whatsapp.send_text_message(phone_clean, message_test)

    if success:
        print(f"\n✅ Sucesso! {result}")
        return True
    else:
        print(f"\n❌ Erro: {result}")
        return False


async def test_notification_formats():
    """Mostra exemplos de mensagens de notificação"""
    await print_section("4️⃣  EXEMPLOS DE MENSAGENS")

    whatsapp = WhatsAppNotificationService(
        base_url=settings.waha_base_url, api_key=settings.waha_api_key
    )

    due_date = datetime.now() + timedelta(days=5)

    examples = [
        (
            "DESPESA - 5 DIAS ANTES",
            whatsapp.send_notification_expense_5_days_before(
                "5599999999999", "Conta de Luz", 185.00, due_date
            )[1],
        ),
        (
            "DESPESA - 1 DIA ANTES",
            whatsapp.send_notification_expense_1_day_before(
                "5599999999999", "Conta de Internet", 150.00, due_date
            )[1],
        ),
        (
            "DESPESA - VENCIDA (3 dias atraso)",
            whatsapp.send_notification_expense_overdue(
                "5599999999999", "Conta de Água", 95.50, due_date, 3
            )[1],
        ),
        (
            "DÍVIDA - 5 DIAS ANTES",
            whatsapp.send_notification_debt_5_days_before(
                "5599999999999", "Cartão Nubank", 2500.00, due_date
            )[1],
        ),
        (
            "DÍVIDA - 1 DIA ANTES",
            whatsapp.send_notification_debt_1_day_before(
                "5599999999999", "Empréstimo Pessoal", 5000.00, due_date
            )[1],
        ),
        (
            "DÍVIDA - VENCIDA (2 dias atraso)",
            whatsapp.send_notification_debt_overdue(
                "5599999999999", "Cheque Especial", 1200.00, due_date, 2
            )[1],
        ),
    ]

    for title, message in examples:
        print(f"\n{'─' * 60}")
        print(f"📌 {title}")
        print(f"{'─' * 60}")
        print(message)


async def run_all_tests(phone: str = None):
    """Executa todos os testes"""
    print("\n" + "=" * 60)
    print("  🚀 TESTE DE NOTIFICAÇÕES - CONTROLE DE CONTAS")
    print("=" * 60)

    # Teste 1: Configuração
    if not await test_environment():
        print("\n❌ Configuração inválida. Abortando.")
        return False

    # Teste 2: Conexão
    if not await test_connection():
        print("\n❌ Não foi possível conectar. Verifique:")
        print("  - WAHA está rodando?")
        print("  - API Key está correta?")
        print("  - Conectado à VPN?")
        return False

    # Teste 3: Envio de Mensagem
    if phone or input("\n💬 Deseja testar envio de mensagem? (s/n): ").lower() == "s":
        if not await test_send_message(phone):
            print("\n⚠️  Falha no envio, mas pode ser problema de número/sessão")

    # Teste 4: Exemplos
    if input("\n📋 Mostrar exemplos de mensagens? (s/n): ").lower() == "s":
        await test_notification_formats()

    await print_section("✅ TESTES CONCLUÍDOS")

    print("""
Próximos passos:
1. Configure ENABLE_NOTIFICATIONS=true no .env
2. Inicie o backend: python main.py
3. O scheduler rodará diariamente na hora configurada
4. Monitore em: GET /api/notifications/history
    """)

    return True


if __name__ == "__main__":
    # Se passar --phone como argumento
    phone = None
    if len(sys.argv) > 1:
        phone = sys.argv[1]

    try:
        success = asyncio.run(run_all_tests(phone))
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Teste cancelado pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
