"""
Script para normalizar números de telefone no banco de dados
Converte todos os números para o formato: 55XXXXXXXXXX (válido para WhatsApp)
"""

import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

# Adiciona o diretório backend ao path para imports
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import settings
from utils.formatting import normalize_phone_for_whatsapp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def normalize_phones():
    """
    Normaliza todos os telefones no banco de dados
    """
    # Conecta ao MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    logger.info("🔄 Iniciando normalização de telefones...")
    logger.info(f"📦 Banco de dados: {settings.database_name}")

    try:
        # Busca todos os usuários
        users = await db.users.find({}).to_list(None)
        logger.info(f"📊 Total de usuários: {len(users)}")

        normalized_count = 0
        invalid_count = 0
        no_phone_count = 0

        for user in users:
            user_id = str(user.get("_id"))
            user_name = user.get("full_name", "Desconhecido")
            phone = user.get("phone")

            if not phone:
                logger.warning(f"⚠️  Usuário {user_name} ({user_id}) - SEM TELEFONE")
                no_phone_count += 1
                continue

            # Normaliza o telefone
            phone_normalized = normalize_phone_for_whatsapp(phone)

            if not phone_normalized:
                logger.error(
                    f"❌ Telefone inválido para {user_name} ({user_id}): {phone}"
                )
                invalid_count += 1
                continue

            # Se já está normalizado, pula
            if phone == phone_normalized:
                logger.debug(f"✅ {user_name} - já normalizado: {phone}")
                continue

            # Atualiza no banco
            result = await db.users.update_one(
                {"_id": user.get("_id")},
                {"$set": {"phone": phone_normalized, "updated_at": datetime.utcnow()}},
            )

            if result.modified_count > 0:
                logger.info(f"✅ {user_name}: {phone} → {phone_normalized}")
                normalized_count += 1
            else:
                logger.warning(f"⚠️  Falha ao atualizar {user_name}")

        # Resumo
        logger.info("\n" + "=" * 60)
        logger.info("📋 RESUMO DA NORMALIZAÇÃO")
        logger.info("=" * 60)
        logger.info(f"✅ Telefones normalizados: {normalized_count}")
        logger.info(f"❌ Telefones inválidos: {invalid_count}")
        logger.info(f"⚠️  Sem telefone: {no_phone_count}")
        logger.info(f"📊 Total processado: {len(users)}")
        logger.info("=" * 60 + "\n")

        if invalid_count > 0:
            logger.warning("⚠️  Existem usuários com telefones inválidos!")
            logger.warning("   Verifique e corrija manualmente no banco de dados")

    except Exception as e:
        logger.error(f"❌ Erro ao normalizar telefones: {e}", exc_info=True)

    finally:
        client.close()
        logger.info("✅ Processo concluído")


if __name__ == "__main__":
    asyncio.run(normalize_phones())
