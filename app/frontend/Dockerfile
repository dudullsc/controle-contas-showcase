# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Aceita a variável de ambiente
ARG NEXT_PUBLIC_API_URL=https://contas.example.com/cc-api
ARG NEXT_PUBLIC_APP_VERSION=0.0.0
ARG NEXT_PUBLIC_APP_BUILD=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_BUILD=$NEXT_PUBLIC_APP_BUILD

# Copia arquivos de dependência
COPY package*.json ./

# Instala dependências (usa lockfile se existir)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copia o código fonte
COPY . .

# Compila o Next.js (cria a pasta .next) com a variável de ambiente
RUN printf '%s' "$NEXT_PUBLIC_APP_VERSION" > public/version \
  && npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copia apenas o necessário para rodar
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

# Expõe a porta padrão do Next
EXPOSE 3000

# Inicia o servidor
CMD ["npm", "start"]
