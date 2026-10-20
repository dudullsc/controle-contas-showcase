# Backend - Guia rapido de `uv`

Este backend atualmente usa `requirements.txt` para dependencias.
Por isso, o fluxo recomendado com `uv` aqui e `uv pip ...`.

## 1) Preparar ambiente virtual

No PowerShell, dentro de `app/backend`:

```powershell
# criar venv (se ainda nao existir)
uv venv .venv

# ativar
.\.venv\Scripts\Activate.ps1
```

## 2) Instalar dependencias do projeto

```powershell
uv pip install -r requirements.txt
```

## 3) Sincronizar ambiente exatamente com requirements

Use este comando para remover pacotes extras e deixar o ambiente igual ao arquivo:

```powershell
uv pip sync requirements.txt
```

## 4) Verificar pacotes desatualizados

```powershell
uv pip list --outdated
```

## 5) Atualizar pacotes

Atualizar 1 pacote:

```powershell
uv pip install -U fastapi
```

Atualizar varios pacotes:

```powershell
uv pip install -U certifi coverage cryptography fastapi pdfminer-six pillow pydantic-core pydantic-settings pypdfium2 python-dotenv ruff starlette uvicorn yarl
```

Atualizar todos os desatualizados (PowerShell):

```powershell
$pkgs = uv pip list --outdated | Select-Object -Skip 2 | ForEach-Object { ($_ -split '\s+')[0] } | Where-Object { $_ }
uv pip install -U $pkgs
```

## 6) Congelar versoes apos atualizar

Depois de atualizar, grave as versoes no `requirements.txt`:

```powershell
uv pip freeze > requirements.txt
```

## 7) Comandos uteis do dia a dia

Rodar API:

```powershell
uv run uvicorn main:app --reload
```

Rodar testes:

```powershell
uv run pytest
```

Rodar lint:

```powershell
uv run ruff check .
```

Formatar:

```powershell
uv run ruff format .
```

## 8) Sobre `uv sync`

`uv sync` funciona melhor quando dependencias estao declaradas no `pyproject.toml`
(com `[project]` ou `dependency-groups`) e, opcionalmente, com `uv.lock`.

Hoje este projeto nao declara dependencias no `pyproject.toml`, entao:

- Use `uv pip install -r requirements.txt` para instalar
- Use `uv pip sync requirements.txt` para sincronizar

Se voce quiser, no proximo passo eu posso migrar o backend para o modelo moderno:
`pyproject.toml` + `uv.lock` + `uv sync` como fluxo principal.
