#!/bin/bash

echo "🚀 Iniciando API do Sistema Bar..."
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT_DIR/api"
cd "$API_DIR" || { echo "❌ Não foi possível acessar $API_DIR"; exit 1; }

# Verificar se .env existe
if [ ! -f .env ]; then
  echo "📋 Criando arquivo .env..."
  cp env_exemplo .env
fi

# Garantir porta 4000 e host 0.0.0.0
if grep -q "^PORT=" .env; then
  sed -i '' 's/^PORT=.*/PORT=4000/' .env
else
  echo "PORT=4000" >> .env
fi
if ! grep -q "^HOST=" .env; then
  echo "HOST=0.0.0.0" >> .env
fi

# Exportar variáveis do .env
set -a
source .env
set +a

DB_TARGET="${1:-local}"

# Garantir variáveis de conexão
if ! grep -q "^DATABASE_URL_LOCAL=" .env; then
  echo "DATABASE_URL_LOCAL=\"mysql://root:saguides%40123@localhost:3306/appBar\"" >> .env
fi
if ! grep -q "^DATABASE_URL_RAILWAY=" .env; then
  # Se já existir DATABASE_URL em .env, use como Railway
  if grep -q "^DATABASE_URL=" .env; then
    RAIL=$(grep "^DATABASE_URL=" .env | sed 's/^DATABASE_URL=//')
    echo "DATABASE_URL_RAILWAY=${RAIL}" >> .env
  else
    echo "DATABASE_URL_RAILWAY=\"mysql://root:EcNHsXSBfTPvATYnaVMSGHKIOjDMZnZx@shuttle.proxy.rlwy.net:17474/railway\"" >> .env
  fi
fi

# Recarregar variáveis
set -a
source .env
set +a

if [ "$DB_TARGET" = "railway" ]; then
  export DATABASE_URL="$DATABASE_URL_RAILWAY"
  export DB_TARGET="railway"
else
  export DATABASE_URL="$DATABASE_URL_LOCAL"
  export DB_TARGET="local"
fi

DETECTED_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$DETECTED_IP" ]; then
  DETECTED_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
LAN_IP=${REACT_NATIVE_PACKAGER_HOSTNAME:-$DETECTED_IP}
if [ -n "$LAN_IP" ]; then
  echo "🔗 API LAN URL: http://${LAN_IP}:4000/api"
fi

# Funções utilitárias para garantir reinício limpo
kill_by_port() {
  PORT_TO_KILL="$1"
  PIDS=$(lsof -tiTCP:"$PORT_TO_KILL")
  if [ -n "$PIDS" ]; then
    echo "🧹 Encerrando processos na porta $PORT_TO_KILL: $PIDS"
    kill -9 $PIDS 2>/dev/null
  fi
}


# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependências..."
  npm install
fi

# Pular migrações para não tocar nos dados existentes
echo "🛠️ Aplicando schema do Prisma (db push)"
npx prisma db push >/dev/null 2>&1 || true
echo "🧩 Gerando Prisma Client"

npx prisma generate >/dev/null 2>&1 || true

# Garantir porta livre e iniciar servidor
kill_by_port 4000
echo "🔧 Iniciando servidor na porta 4000 (0.0.0.0) usando DB_TARGET=$DB_TARGET..."
npm start

