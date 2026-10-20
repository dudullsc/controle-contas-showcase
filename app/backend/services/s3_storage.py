"""MinIO/S3 storage for expense payment receipts."""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from config import settings

MAX_RECEIPT_BYTES = 5 * 1024 * 1024


class ReceiptValidationError(ValueError):
    pass


class StorageNotConfiguredError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(
        settings.s3_endpoint
        and settings.s3_access_key
        and settings.s3_secret_key
        and settings.s3_bucket
    )


def detect_file_type(data: bytes) -> tuple[str, str]:
    """Return (extension, content_type) from magic bytes."""
    if len(data) < 12:
        raise ReceiptValidationError("Arquivo inválido ou muito pequeno")

    if data.startswith(b"\xff\xd8\xff"):
        return "jpg", "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png", "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    if data.startswith(b"%PDF"):
        return "pdf", "application/pdf"

    raise ReceiptValidationError("Tipo não permitido. Envie JPG, PNG, WEBP ou PDF")


def validate_receipt(data: bytes) -> tuple[str, str]:
    max_bytes = settings.s3_max_receipt_bytes or MAX_RECEIPT_BYTES
    if len(data) == 0:
        raise ReceiptValidationError("Arquivo vazio")
    if len(data) > max_bytes:
        mb = max(1, max_bytes // (1024 * 1024))
        raise ReceiptValidationError(f"Arquivo maior que {mb} MB")
    return detect_file_type(data)


def _client():
    if not is_configured():
        raise StorageNotConfiguredError(
            "Armazenamento de comprovantes não configurado"
        )

    endpoint = settings.s3_endpoint.strip()
    if "://" not in endpoint:
        scheme = "https" if settings.s3_use_ssl else "http"
        endpoint = f"{scheme}://{endpoint}"

    parsed = urlparse(endpoint)
    endpoint_url = f"{parsed.scheme}://{parsed.netloc}"

    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region or "us-east-1",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def ensure_bucket() -> None:
    if not is_configured():
        print("⚠️  S3/MinIO não configurado — comprovantes desabilitados")
        return

    client = _client()
    bucket = settings.s3_bucket
    try:
        client.head_bucket(Bucket=bucket)
        print(f"✅ Bucket S3 '{bucket}' disponível")
    except ClientError as e:
        code = str(e.response.get("Error", {}).get("Code", ""))
        if code in ("404", "NoSuchBucket", "404 Not Found"):
            try:
                client.create_bucket(Bucket=bucket)
                print(f"✅ Bucket S3 '{bucket}' criado")
            except ClientError as create_err:
                print(f"⚠️  Não foi possível criar bucket S3: {create_err}")
        else:
            print(f"⚠️  Não foi possível acessar bucket S3: {e}")


def build_object_key(family_id: str, expense_id: str, ext: str) -> str:
    safe_family = family_id or "unknown"
    return f"receipts/{safe_family}/{expense_id}/{uuid.uuid4().hex}.{ext}"


def upload_bytes(object_key: str, data: bytes, content_type: str) -> None:
    _client().put_object(
        Bucket=settings.s3_bucket,
        Key=object_key,
        Body=data,
        ContentType=content_type,
    )


def get_object(object_key: str) -> tuple[bytes, str]:
    response = _client().get_object(Bucket=settings.s3_bucket, Key=object_key)
    body = response["Body"].read()
    content_type = response.get("ContentType") or "application/octet-stream"
    return body, content_type


def delete_object(object_key: str | None) -> None:
    if not object_key or not is_configured():
        return
    try:
        _client().delete_object(Bucket=settings.s3_bucket, Key=object_key)
    except ClientError:
        pass
