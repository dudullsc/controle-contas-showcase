"""
Utilitários para validação e formatação de CPF
"""


def validate_cpf(cpf: str) -> bool:
    """
    Valida se o CPF é válido
    Args:

         cpf: CPF com ou sem formatação

    Returns:
        True se o CPF é válido, False caso contrário
    """
    # Remove caracteres não numéricos
    cpf_clean = "".join(filter(str.isdigit, cpf))

    # Verifica se tem 11 dígitos
    if len(cpf_clean) != 11:
        return False

    # Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
    if cpf_clean == cpf_clean[0] * 11:
        return False

    # Validação do primeiro dígito verificador
    soma = sum(int(cpf_clean[i]) * (10 - i) for i in range(9))
    resto = (soma * 10) % 11
    if resto == 10 or resto == 11:
        resto = 0
    if resto != int(cpf_clean[9]):
        return False

    # Validação do segundo dígito verificador
    soma = sum(int(cpf_clean[i]) * (11 - i) for i in range(10))
    resto = (soma * 10) % 11
    if resto == 10 or resto == 11:
        resto = 0
    if resto != int(cpf_clean[10]):
        return False

    return True


def format_cpf(cpf: str) -> str:
    """
    Formata o CPF no padrão XXX.XXX.XXX-XX

    Args:
        cpf: CPF com ou sem formatação

    Returns:
        CPF formatado
    """
    cpf_clean = "".join(filter(str.isdigit, cpf))

    if len(cpf_clean) != 11:
        return cpf

    return f"{cpf_clean[:3]}.{cpf_clean[3:6]}.{cpf_clean[6:9]}-{cpf_clean[9:]}"


def clean_cpf(cpf: str) -> str:
    """
    Remove formatação do CPF, deixando apenas números

    Args:
        cpf: CPF com ou sem formatação

    Returns:
        CPF apenas com números
    """
    return "".join(filter(str.isdigit, cpf))
