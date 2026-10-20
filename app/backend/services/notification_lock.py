"""
Proteção contra envio duplicado em múltiplas instâncias do backend
Usa timestamp no banco para garantir que só uma instância executa por vez
"""

import logging
from datetime import UTC, datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class NotificationLock:
    """
    Gerencia lock distribuído para evitar que múltiplas instâncias
    enviem notificações duplicadas
    """

    LOCK_KEY = "notification_lock"
    LOCK_TIMEOUT = 3600  # 1 hora em segundos

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def acquire_lock(self) -> bool:
        """
        Tenta adquirir lock para envio de notificações

        Returns:
            True se conseguiu o lock, False se outro processo já tem
        """
        try:
            now = datetime.now(UTC)
            lock_expires = now + timedelta(seconds=self.LOCK_TIMEOUT)

            # Tenta inserir documeno de lock
            # Se já existe e não expirou, falha
            result = await self.db.notification_locks.update_one(
                {
                    "_id": self.LOCK_KEY,
                    "expires_at": {"$lt": now},  # Só atualiza se expirou
                },
                {
                    "$set": {
                        "_id": self.LOCK_KEY,
                        "acquired_at": now,
                        "expires_at": lock_expires,
                        "instance_id": self._get_instance_id(),
                    }
                },
                upsert=True,
            )

            # Se nenhum doc foi modificado, significa que outro processo tem o lock
            if result.matched_count == 0 and result.upserted_id is None:
                logger.warning(
                    "⏳ Outro processo está enviando notificações. Aguardando próximo ciclo..."
                )
                return False

            logger.info("🔒 Lock adquirido com sucesso")
            return True

        except Exception as e:
            logger.error(f"❌ Erro ao adquirir lock: {e}")
            return False

    async def release_lock(self):
        """
        Libera o lock após finalizar
        """
        try:
            await self.db.notification_locks.delete_one({"_id": self.LOCK_KEY})
            logger.info("🔓 Lock liberado")
        except Exception as e:
            logger.error(f"⚠️  Erro ao liberar lock: {e}")

    @staticmethod
    def _get_instance_id() -> str:
        """Gera ID único para a instância (hostname + PID)"""
        import os
        import socket

        return f"{socket.gethostname()}:{os.getpid()}"
