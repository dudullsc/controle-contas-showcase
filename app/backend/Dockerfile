# Usa python leve
FROM python:3.11-slim

WORKDIR /app

# Dependências de sistema + mongodump (MongoDB Database Tools)
ARG MONGO_TOOLS_VERSION=100.10.0
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc libpq-dev curl ca-certificates \
    && curl -fsSL \
        "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-${MONGO_TOOLS_VERSION}.tgz" \
        -o /tmp/mongo-tools.tgz \
    && tar -xzf /tmp/mongo-tools.tgz -C /tmp \
    && mv /tmp/mongodb-database-tools-*/bin/* /usr/local/bin/ \
    && rm -rf /tmp/mongo-tools.tgz /tmp/mongodb-database-tools-* \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o resto da pasta backend
COPY . .
#teste
# Comando para rodar (ajuste se seu arquivo principal não for main.py)
# Vi na imagem que é 'main.py'. Se for FastAPI:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]