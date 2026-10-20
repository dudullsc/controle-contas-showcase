import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.middleware.gzip import GZipMiddleware  # type: ignore
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings as app_settings
from database import close_mongo_connection, connect_to_mongo, get_database
from routers import (
    admin,
    auth,
    backup,
    debts,
    devices,
    expenses,
    families,
    financial,
    incomes,
    notifications,
    reports,
    settings,
    users,
)
from services.backup_service import scheduled_backup_job
from services.fcm_notification import FcmNotificationService, fcm_is_configured
from services.notification_scheduler import NotificationScheduler
from services.s3_storage import ensure_bucket
from services.whatsapp_notification import build_whatsapp_service
from utils.request_log import (
    RequestLogMiddleware,
    log_http_exception,
    log_validation_error,
)

# Scheduler global
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()

    try:
        await asyncio.to_thread(ensure_bucket)
    except Exception as e:
        print(f"⚠️  Não foi possível inicializar MinIO/S3: {e}")

    # Inicia scheduler (WhatsApp e/ou FCM) se ENABLE_NOTIFICATIONS=true
    if app_settings.enable_notifications:
        try:
            db = await get_database()
            fcm_service = FcmNotificationService()
            fcm_ok = fcm_is_configured()

            whatsapp_service = build_whatsapp_service()
            if whatsapp_service:
                success, message = whatsapp_service.test_connection()
                if success:
                    print(f"✅ {message}")
                else:
                    print(
                        f"⚠️  WAHA indisponível na subida: {message}. "
                        "O ciclo diário tenta conectar de novo."
                    )
            else:
                print("⚠️  WAHA_API_KEY não configurada — só FCM (se houver credenciais)")

            if fcm_ok:
                print("✅ FCM (Firebase) configurado — push no app habilitado")
            else:
                print(
                    "⚠️  FCM sem credenciais (FCM_CREDENTIALS_FILE / FCM_CREDENTIALS_JSON)"
                )

            if whatsapp_service or fcm_ok:
                notification_scheduler = NotificationScheduler(
                    db, whatsapp_service, fcm_service
                )

                try:
                    hour, minute = map(
                        int, app_settings.notification_check_time.split(":")
                    )
                except Exception:
                    hour, minute = 9, 0

                scheduler.add_job(
                    notification_scheduler.check_and_send_notifications,
                    "cron",
                    hour=hour,
                    minute=minute,
                    timezone="America/Sao_Paulo",
                    id="daily_notification_check",
                    name="Daily Notification Check",
                    replace_existing=True,
                )

                scheduler.start()
                time_str = f"{hour:02d}:{minute:02d}"
                print(
                    f"✅ Notification Scheduler iniciado para rodar às {time_str} (America/Sao_Paulo)"
                )
            else:
                print(
                    "⚠️  Notificações desativadas: sem WAHA e sem FCM configurados"
                )
        except Exception as e:
            print(f"⚠️  Não foi possível iniciar Notification Scheduler: {e}")
    else:
        print("⚠️  Notificações desativadas na configuração")

    # Backup Mongo → Google Drive (diário)
    if app_settings.enable_backups:
        try:
            try:
                b_hour, b_minute = map(
                    int, app_settings.backup_cron_time.split(":")
                )
            except Exception:
                b_hour, b_minute = 3, 0

            scheduler.add_job(
                scheduled_backup_job,
                "cron",
                hour=b_hour,
                minute=b_minute,
                id="daily_mongodb_backup",
                name="Daily MongoDB Backup to Google Drive",
                replace_existing=True,
            )
            if not scheduler.running:
                scheduler.start()
            print(
                f"✅ Backup Scheduler iniciado para rodar às "
                f"{b_hour:02d}:{b_minute:02d}"
            )
        except Exception as e:
            print(f"⚠️  Não foi possível iniciar Backup Scheduler: {e}")
    else:
        print("⚠️  Backups desativados na configuração (ENABLE_BACKUPS)")

    yield

    # Shutdown
    try:
        scheduler.shutdown()
    except Exception:
        pass

    await close_mongo_connection()


app = FastAPI(
    title="Controle de Contas API",
    description="API para gerenciamento de despesas pessoais",
    version="1.0.0",
    lifespan=lifespan,
)

# Compressão GZip para respostas maiores que 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS - Configurável via variável de ambiente
# Por padrão, permite localhost e o domínio de produção
default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "https://contas.example.com",
    "http://contas.example.com",
]

# Permite adicionar origens extras via variável de ambiente)
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    # Adiciona origens da variável de ambiente
    additional_origins = [
        origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()
    ]
    default_origins.extend(additional_origins)

# Remove duplicatas mantendo a ordem
allowed_origins = list(dict.fromkeys(default_origins))

app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(HTTPException, log_http_exception)
app.add_exception_handler(StarletteHTTPException, log_http_exception)
app.add_exception_handler(RequestValidationError, log_validation_error)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Rotas
app.include_router(admin.router, prefix="/api")
app.include_router(auth.router, prefix="/api")

app.include_router(users.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(debts.router, prefix="/api")
app.include_router(financial.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(families.router, prefix="/api")
app.include_router(incomes.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(devices.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Controle de Contas API", "version": "1.0.0", "status": "online"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/version")
async def get_version():
    """Retorna informações de versão e build do backend"""
    # Busca do .env ou usa padrão
    version = os.getenv("APP_VERSION", "1.0.20")
    build = os.getenv("APP_BUILD", datetime.now().strftime("%Y%m%d"))

    return {"version": version, "build": build, "backend": True}


if __name__ == "__main__":
    import uvicorn  # type: ignore

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=["test_*.py", "criar_*.py", "setup_*.py", "*_test.py"],
    )
