"""Utilitários para capturar o IP real do cliente atrás de proxies"""

from fastapi import Request


def get_client_ip(request: Request) -> str:
    """
    Extrai o IP real do cliente considerando proxies reversos.

    Tenta os seguintes headers na ordem:
    1. X-Forwarded-For (usado por nginx, HAProxy, etc)
    2. X-Real-IP (usado por nginx)
    3. CF-Connecting-IP (Cloudflare)
    4. True-Client-IP (Cloudflare Enterprise)
    5. request.client.host (fallback para conexão direta)

    Args:
        request: Objeto Request do FastAPI

    Returns:
        IP do cliente ou "unknown"
    """
    # Tenta X-Forwarded-For (pode conter múltiplos IPs separados por vírgula)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # Pega o primeiro IP da lista (é o cliente original)
        return forwarded_for.split(",")[0].strip()

    # Tenta X-Real-IP
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()

    # Tenta CF-Connecting-IP (Cloudflare)
    cf_connecting = request.headers.get("cf-connecting-ip")
    if cf_connecting:
        return cf_connecting.strip()

    # Tenta True-Client-IP (Cloudflare Enterprise)
    true_client = request.headers.get("true-client-ip")
    if true_client:
        return true_client.strip()

    # Fallback para conexão direta
    if request.client:
        return request.client.host

    return "unknown"
