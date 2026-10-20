# 🎨 Guia de Formatação e Linting

Este documento explica como usar as ferramentas de formatação e linting do projeto para manter o código consistente e bem organizado.

---

## 📋 Índice

1. [Backend (Python) - Ruff](#backend-python---ruff)
2. [Frontend (TypeScript/JavaScript) - Prettier e ESLint](#frontend-typescriptjavascript---prettier-e-eslint)
3. [Boas Práticas](#boas-práticas)

---

## 🐍 Backend (Python) - Ruff

### O que é Ruff?

**Ruff** é um linter e formatador Python ultra-rápido que verifica e corrige problemas no código como:
- Espaçamento e indentação
- Imports não utilizados
- Nomes de variáveis
- Padrões de código (PEP 8)
- Simplificações e otimizações

É o equivalente do Prettier/ESLint para Python, mas muito mais rápido!

### Instalação

O Ruff já está instalado no seu ambiente Python. Para verificar:

```bash
cd app/backend
ruff --version
```

### Verificar Erros

Para verificar erros sem corrigir:

```bash
cd app/backend
ruff check .
```

Ou para um arquivo específico:

```bash
ruff check seu_arquivo.py
```

### Formatar Automaticamente

Para formatar e corrigir problemas automaticamente:

```bash
cd app/backend
ruff check . --fix
```

### Configuração

A configuração do Ruff está em `app/backend/pyproject.toml`:

```toml
[tool.ruff]
line-length = 88
exclude = [".venv", "__pycache__", ".git"]
```

### Exemplos Práticos

**Antes (com problemas):**
```python
import os
import sys
import json  # não usado

x=1+2
result = x


def func( a , b ):
    return a+b
```

**Depois (depois de `ruff check . --fix`):**
```python
import os
import sys

x = 1 + 2
result = x


def func(a, b):
    return a + b
```