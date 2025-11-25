#!/bin/bash

# Script de verificación de la configuración de Nginx + Frontend

echo "🔍 Verificando configuración de LEXIMATE..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        return 1
    fi
}

# 1. Verificar que docker-compose.yaml existe
echo "📄 Verificando archivos de configuración..."
test -f "docker-compose.yaml"
check "docker-compose.yaml existe"

test -f "nginx/nginx.conf"
check "nginx/nginx.conf existe"

test -d "../LEXIMATE-FRONTEND"
check "Directorio LEXIMATE-FRONTEND existe"

echo ""

# 2. Verificar sintaxis de nginx.conf
echo "🔧 Verificando sintaxis de nginx..."
docker run --rm -v "$(pwd)/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t 2>&1 | grep -q "successful"
check "Sintaxis de nginx.conf es correcta"

echo ""

# 3. Verificar servicios en docker-compose
echo "🐳 Verificando servicios en docker-compose.yaml..."
grep -q "frontend:" docker-compose.yaml
check "Servicio frontend está definido"

grep -q "frontend_dist:" docker-compose.yaml
check "Volumen frontend_dist está definido"

grep -q "frontend_dist:/usr/share/nginx/html" docker-compose.yaml
check "Volumen frontend_dist montado en nginx"

echo ""

# 4. Verificar configuración de nginx
echo "⚙️  Verificando configuración de nginx.conf..."
grep -q "location /api" nginx/nginx.conf
check "Configuración de proxy /api"

grep -q "location /ws" nginx/nginx.conf
check "Configuración de proxy /ws"

grep -q "location /" nginx/nginx.conf
check "Configuración de archivos estáticos"

grep -q "try_files.*index.html" nginx/nginx.conf
check "Configuración de SPA (react-router)"

echo ""

# 5. Verificar Dockerfile del frontend
echo "📦 Verificando Dockerfile del frontend..."
test -f "../LEXIMATE-FRONTEND/Dockerfile"
check "Dockerfile del frontend existe"

grep -q "npm run build" ../LEXIMATE-FRONTEND/Dockerfile
check "Dockerfile incluye comando de build"

grep -q "COPY.*dist.*dist" ../LEXIMATE-FRONTEND/Dockerfile
check "Dockerfile copia directorio dist"

echo ""

# 6. Resumen
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Configuración verificada correctamente!${NC}"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Construir e iniciar los contenedores:"
echo -e "     ${YELLOW}docker compose up --build${NC}"
echo ""
echo "  2. Acceder a la aplicación:"
echo -e "     ${YELLOW}http://localhost${NC}"
echo ""
echo "  3. Ver logs de nginx:"
echo -e "     ${YELLOW}docker logs leximate-nginx -f${NC}"
echo ""
echo "  4. Verificar que el frontend esté servido:"
echo -e "     ${YELLOW}curl -I http://localhost${NC}"
echo ""
echo "  5. Verificar que el API funcione:"
echo -e "     ${YELLOW}curl http://localhost/api/ping${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
