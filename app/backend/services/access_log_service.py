import logging
from datetime import UTC, datetime

import aiohttp
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.access_log import AccessStatus

logger = logging.getLogger(__name__)


class AccessLogService:
    """Serviço para registrar acessos de usuários no sistema"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_geolocation(self, ip_address: str) -> dict:
        """
        Busca geolocalização do IP usando ip-api.com (gratuito)
        Retorna: {country, city, latitude, longitude}
        """
        if not ip_address or ip_address == "127.0.0.1":
            return {}

        try:
            # Timeout curto para não bloquear o login
            timeout = aiohttp.ClientTimeout(total=3)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"http://ip-api.com/json/{ip_address}"
                try:
                    async with session.get(url) as response:
                        if response.status == 200:
                            data = await response.json()
                            if data.get("status") == "success":
                                return {
                                    "country": data.get("country"),
                                    "city": data.get("city"),
                                    "latitude": data.get("lat"),
                                    "longitude": data.get("lon"),
                                }
                except TimeoutError:
                    logger.warning(
                        f"Timeout ao buscar geolocalização para IP {ip_address}"
                    )
                    return {}
        except Exception as e:
            logger.warning(f"Erro ao buscar geolocalização para IP {ip_address}: {e}")

        return {}

    async def log_access(
        self,
        user_email: str,
        user_id: str | None,
        status: AccessStatus,
        ip_address: str,
        user_agent: str,
        error_message: str | None = None,
    ) -> str:
        """
        Registra um acesso de usuário no banco de dados
        Retorna: ID do log criado
        """
        try:
            # Busca geolocalização
            geo_data = await self.get_geolocation(ip_address)

            # Cria documento do log
            log_data = {
                "user_email": user_email,
                "user_id": user_id,
                "status": status.value,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "country": geo_data.get("country"),
                "city": geo_data.get("city"),
                "latitude": geo_data.get("latitude"),
                "longitude": geo_data.get("longitude"),
                "error_message": error_message,
                "timestamp": datetime.now(UTC),
            }

            # Insere no banco
            result = await self.db.access_logs.insert_one(log_data)
            return str(result.inserted_id)

        except Exception as e:
            logger.error(f"Erro ao registrar access log: {e}")
            raise

    async def get_access_logs(
        self,
        user_email: str | None = None,
        status: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        ip_address: str | None = None,
        country: str | None = None,
        city: str | None = None,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "timestamp",
        sort_order: int = -1,  # -1 para desc, 1 para asc
    ) -> tuple[list, int]:
        """
        Busca logs de acesso com filtros
        Retorna: (logs, total_count)
        """
        try:
            query = {}

            # Filtros
            if user_email:
                query["user_email"] = {"$regex": user_email, "$options": "i"}
            if status:
                query["status"] = status
            if ip_address:
                query["ip_address"] = ip_address
            if country:
                query["country"] = {"$regex": country, "$options": "i"}
            if city:
                query["city"] = {"$regex": city, "$options": "i"}

            # Filtro de data
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query["$gte"] = start_date
                if end_date:
                    # Inclui até o final do dia especificado
                    end_of_day = end_date.replace(
                        hour=23, minute=59, second=59, microsecond=999999
                    )
                    date_query["$lte"] = end_of_day
                query["timestamp"] = date_query

            # Contagem total
            total_count = await self.db.access_logs.count_documents(query)

            # Busca registros
            cursor = self.db.access_logs.find(query)
            cursor = cursor.sort(sort_by, sort_order)
            cursor = cursor.skip(skip).limit(limit)

            logs = await cursor.to_list(length=limit)

            return logs, total_count

        except Exception as e:
            logger.error(f"Erro ao buscar access logs: {e}")
            raise

    async def get_user_access_logs(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list, int]:
        """
        Busca logs de acesso de um usuário específico
        Retorna: (logs, total_count)
        """
        try:
            query = {"user_id": user_id}

            total_count = await self.db.access_logs.count_documents(query)

            cursor = self.db.access_logs.find(query)
            cursor = cursor.sort("timestamp", -1)
            cursor = cursor.skip(skip).limit(limit)

            logs = await cursor.to_list(length=limit)

            return logs, total_count

        except Exception as e:
            logger.error(f"Erro ao buscar access logs do usuário: {e}")
            raise

    async def get_access_stats(self) -> dict:
        """
        Retorna estatísticas de acesso
        """
        try:
            total_accesses = await self.db.access_logs.count_documents({})
            successful = await self.db.access_logs.count_documents(
                {"status": "SUCCESS"}
            )
            failed = await self.db.access_logs.count_documents(
                {"status": {"$ne": "SUCCESS"}}
            )

            # Top 10 usuários
            top_users = await self.db.access_logs.aggregate(
                [
                    {"$match": {"status": "SUCCESS"}},
                    {"$group": {"_id": "$user_email", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                    {"$limit": 10},
                ]
            ).to_list(length=10)

            # Top 10 IPs
            top_ips = await self.db.access_logs.aggregate(
                [
                    {"$group": {"_id": "$ip_address", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                    {"$limit": 10},
                ]
            ).to_list(length=10)

            return {
                "total_accesses": total_accesses,
                "successful_accesses": successful,
                "failed_accesses": failed,
                "success_rate": (successful / total_accesses * 100)
                if total_accesses > 0
                else 0,
                "top_users": top_users,
                "top_ips": top_ips,
            }

        except Exception as e:
            logger.error(f"Erro ao calcular estatísticas de acesso: {e}")
            raise
