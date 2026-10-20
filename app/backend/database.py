from motor.motor_asyncio import AsyncIOMotorClient

from config import settings


class Database:
    client: AsyncIOMotorClient = None


db = Database()


async def get_database():
    return db.client[settings.database_name]


async def connect_to_mongo():
    """Conecta ao MongoDB local"""
    db.client = AsyncIOMotorClient(settings.mongodb_url)
    try:
        # Testa a conexão
        await db.client.admin.command("ping")
        print(f"✅ Conectado ao MongoDB: {settings.mongodb_url}")
    except Exception as e:
        print(f"❌ Erro ao conectar ao MongoDB: {e}")
        raise


async def close_mongo_connection():
    """Fecha a conexão com o MongoDB"""
    if db.client:
        db.client.close()
        print("🔌 Conexão com MongoDB fechada")
