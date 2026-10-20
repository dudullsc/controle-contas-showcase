"""
Utilitários para formatação de valores monetários e outros dados
"""

import locale
from datetime import UTC, datetime, timedelta, timezone

# Configurar locale para português brasileiro
try:
    locale.setlocale(locale.LC_ALL, "pt_BR.UTF-8")
except locale.Error:
    # Fallback se locale não estiver disponível
    pass

# Timezone de São Paulo (Brasil)
SAO_PAULO_TZ = timezone(
    timedelta(hours=-3)
)  # UTC-3 (padrão) ou UTC-2 (horário de verão)


def format_currency_br(value: float) -> str:
    """
    Formata valor monetário no padrão brasileiro (1.234,56)

    Args:
        value: Valor numérico a ser formatado

    Returns:
        String formatada no padrão brasileiro (ex: "1.234,56")
    """
    # Converter para string com 2 casas decimais
    value_str = f"{value:.2f}"
    # Separar parte inteira e decimal
    if "." in value_str:
        integer_part, decimal_part = value_str.split(".")
    else:
        integer_part = value_str
        decimal_part = "00"

    # Adicionar separador de milhares
    integer_formatted = ""
    for i, digit in enumerate(reversed(integer_part)):
        if i > 0 and i % 3 == 0:
            integer_formatted = "." + integer_formatted
        integer_formatted = digit + integer_formatted

    return f"{integer_formatted},{decimal_part}"


def format_currency_with_symbol(value: float) -> str:
    """
    Formata valor monetário com símbolo R$ no padrão brasileiro

    Args:
        value: Valor numérico a ser formatado

    Returns:
        String formatada com símbolo (ex: "R$ 1.234,56")
    """
    return f"R$ {format_currency_br(value)}"


def format_cpf(cpf: str | None) -> str | None:
    """
    Formata CPF no padrão brasileiro (XXX.XXX.XXX-XX)

    Args:
        cpf: CPF sem formatação (11 dígitos) ou None

    Returns:
        CPF formatado (ex: "123.456.789-10") ou None se input for None
    """
    if not cpf:
        return None

    # Remove caracteres não numéricos
    cpf_clean = "".join(filter(str.isdigit, cpf))

    if len(cpf_clean) != 11:
        return cpf  # Retorna original se não tiver 11 dígitos

    return f"{cpf_clean[0:3]}.{cpf_clean[3:6]}.{cpf_clean[6:9]}-{cpf_clean[9:11]}"


def format_phone(phone: str | None) -> str | None:
    """
    Formata telefone no padrão brasileiro ((XX) XXXXX-XXXX)

    Args:
        phone: Telefone em qualquer formato (com ou sem código do país 55)

    Returns:
        Telefone formatado (ex: "(11) 98765-4321") ou None se input for None
    """
    if not phone:
        return None

    # Remove caracteres não numéricos
    phone_clean = "".join(filter(str.isdigit, phone))

    # Remove código de país (55) se presente no início
    if phone_clean.startswith("55") and len(phone_clean) in [12, 13]:
        phone_clean = phone_clean[2:]

    if len(phone_clean) == 11:
        # Celular: (XX) XXXXX-XXXX
        return f"({phone_clean[0:2]}) {phone_clean[2:7]}-{phone_clean[7:11]}"
    elif len(phone_clean) == 10:
        # Fixo: (XX) XXXX-XXXX
        return f"({phone_clean[0:2]}) {phone_clean[2:6]}-{phone_clean[6:10]}"

    return phone  # Retorna original se não tiver formato esperado


def normalize_phone_for_whatsapp(phone: str | None) -> str | None:
    """
    Normaliza telefone para o formato correto do WhatsApp (55XXXXXXXXXX)

    Valida se o número tem tamanho correto e adiciona código do país se necessário.

    Args:
        phone: Telefone em qualquer formato (ex: "48984464815", "(62) 99702-4248", "55 62 99702-4248")

    Returns:
        Telefone normalizado para WhatsApp (ex: "5548984464815") ou None se inválido
    """
    if not phone:
        return None

    # Remove caracteres não numéricos
    phone_clean = "".join(filter(str.isdigit, phone))

    # Se tem tamanho inválido, retorna None
    if len(phone_clean) < 10:
        return None

    # Se já tem código do país (começa com 55), mantém
    if phone_clean.startswith("55"):
        # Valida se tem 55 + DDD (2 dígitos) + número (8 ou 9 dígitos) = 12 ou 13 dígitos
        if len(phone_clean) in [12, 13]:
            return phone_clean
        else:
            return None

    # Se não tem código do país
    # Esperamos 10 ou 11 dígitos (DDD + número)
    if len(phone_clean) in [10, 11]:
        return f"55{phone_clean}"

    return None  # Número com tamanho inválido


def format_datetime_short(dt: datetime | None) -> str:
    """
    Formata data/hora para padrão brasileiro em horário de São Paulo

    Args:
        dt: Objeto datetime a ser formatado (UTC ou awareness)

    Returns:
        String formatada (ex: "16/02/2026 00:19:25")
    """
    if not dt:
        return ""

    # Se for naive (sem timezone), assume UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)

    # Converte para horário de São Paulo
    sp_time = dt.astimezone(SAO_PAULO_TZ)

    return sp_time.strftime("%d/%m/%Y %H:%M:%S")
