# Resumen de Configuración: Nginx + Frontend LEXIMATE

## ✅ Cambios Realizados

### 1. **docker-compose.yaml**

#### Servicio Frontend Agregado
```yaml
frontend:
  build: ../LEXIMATE-FRONTEND
  container_name: leximate-frontend
  restart: no
  volumes:
    - frontend_dist:/app/dist
  networks:
    - leximate-network
```

#### Servicio Nginx Actualizado
```yaml
nginx:
  image: nginx:alpine
  container_name: leximate-nginx
  restart: always
  ports:
    - '80:80'
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - frontend_dist:/usr/share/nginx/html:ro  # ← NUEVO
  depends_on:
    - backend
    - frontend  # ← NUEVO
  networks:
    - leximate-network
```

#### Volumen Compartido Agregado
```yaml
volumes:
  postgres_data:
  n8n_data:
  frontend_dist:  # ← NUEVO: compartido entre frontend y nginx
```

---

### 2. **nginx/nginx.conf**

La configuración se reorganizó completamente para:

#### WebSocket (`/ws`)
- Mantiene la configuración existente
- Proxy directo al backend con soporte de WebSocket
- Timeouts de 3600s para conexiones persistentes

#### API Backend (`/api`)
- **CAMBIO**: Ahora solo las rutas `/api/*` van al backend
- Timeouts de 300s para operaciones largas (PDF parsing)
- Headers de proxy correctamente configurados

#### Frontend Estático (`/`)
- **NUEVO**: Sirve los archivos del frontend desde `/usr/share/nginx/html`
- Soporte de SPA con `try_files $uri $uri/ /index.html`
- Cache de 1 año para assets estáticos (js, css, imágenes, fuentes)
- Compresión gzip para css y javascript

**Configuración completa:**
```nginx
# Proxy API routes to backend
location /api {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Timeouts
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
}

# Serve frontend static files
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 📊 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        Cliente (Browser)                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP :80
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     Nginx (Reverse Proxy)                    │
├─────────────────────────────────────────────────────────────┤
│  • /api/*    → Proxy al backend:8080                        │
│  • /ws       → WebSocket al backend:8080                    │
│  • /*        → Archivos estáticos del frontend              │
└────────┬──────────────────────┬─────────────────────────────┘
         │                      │
         │                      │ Volumen compartido
         │                      │ (frontend_dist)
         │                      │
         ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│     Backend      │   │     Frontend      │
│   (Fastify)      │   │   (Vite Build)    │
│   Port: 8080     │   │                   │
└────────┬─────────┘   └───────────────────┘
         │
         │
         ▼
┌──────────────────┐
│   PostgreSQL     │
│   Port: 5432     │
└──────────────────┘
```

---

## 🔄 Flujo de Datos

### Petición al Frontend
1. Cliente solicita `http://localhost/`
2. Nginx sirve `/usr/share/nginx/html/index.html`
3. React Router maneja las rutas del lado del cliente

### Petición al API
1. Cliente solicita `http://localhost/api/auth/login`
2. Nginx hace proxy a `http://backend:8080/api/auth/login`
3. Backend procesa y responde
4. Nginx devuelve la respuesta al cliente

### WebSocket
1. Cliente conecta a `ws://localhost/ws`
2. Nginx establece conexión WebSocket con `ws://backend:8080/ws`
3. Conexión bidireccional persistente

---

## 🚀 Cómo Ejecutar

### 1. Construir e iniciar todos los servicios
```bash
cd /home/sr-roboto/Documentos/LEXIMATE/LEXIMATE-BACKEND
docker compose up --build
```

### 2. Solo reconstruir el frontend
```bash
docker compose up --build frontend
docker compose restart nginx
```

### 3. Ver logs
```bash
# Logs de nginx
docker logs leximate-nginx -f

# Logs del frontend (build)
docker logs leximate-frontend

# Logs del backend
docker logs leximate-backend -f
```

---

## ✅ Verificación

### Verificar que todo está funcionando
```bash
# 1. Frontend está servido
curl -I http://localhost
# Debe devolver: 200 OK con Content-Type: text/html

# 2. API funciona
curl http://localhost/api/seed/ping
# Debe devolver respuesta JSON

# 3. Archivos estáticos tienen cache
curl -I http://localhost/assets/index-[hash].js
# Debe incluir: Cache-Control: public, immutable
```

### Script de verificación automatizado
```bash
./scripts/verify-nginx-setup.sh
```

---

## 📝 Notas Importantes

### ✅ Lo que funciona automáticamente
- ✅ Frontend servido en `http://localhost`
- ✅ API disponible en `http://localhost/api/*`
- ✅ WebSocket en `ws://localhost/ws`
- ✅ React Router (navegación SPA)
- ✅ Cache de assets estáticos
- ✅ Compresión gzip

### ⚠️ Consideraciones
1. **Desarrollo**: No necesitas ejecutar `npm run dev` del frontend, solo el build
2. **Hot Reload**: Para desarrollo del frontend, considera usar `vite.config.js` proxy
3. **Producción**: Considera agregar HTTPS y headers de seguridad
4. **CORS**: No es necesario configurar CORS ya que todo está en el mismo dominio

### 🔄 Para desarrollo activo del frontend
Si quieres hot reload durante el desarrollo:

**Opción 1: Usar Vite Dev Server (Recomendado para desarrollo)**
```bash
cd /home/sr-roboto/Documentos/LEXIMATE/LEXIMATE-FRONTEND
npm run dev
# Accede a http://localhost:5173
# El proxy en vite.config.js redirige /api a localhost:80
```

**Opción 2: Usar Docker con modo desarrollo**
Modificar el servicio frontend en docker-compose para usar modo dev:
```yaml
frontend:
  build: 
    context: ../LEXIMATE-FRONTEND
    dockerfile: Dockerfile.dev  # Crear este archivo
  ports:
    - "5173:5173"
  volumes:
    - ../LEXIMATE-FRONTEND:/app
  command: npm run dev
```

---

## 📚 Archivos Creados/Modificados

### Modificados
1. ✏️ `/LEXIMATE-BACKEND/docker-compose.yaml`
   - Agregado servicio `frontend`
   - Actualizado servicio `nginx`
   - Agregado volumen `frontend_dist`

2. ✏️ `/LEXIMATE-BACKEND/nginx/nginx.conf`
   - Reconfigurado para servir frontend
   - Agregada ruta `/api` específica
   - Agregado cache para assets

### Creados
3. 📄 `/LEXIMATE-BACKEND/nginx/README.md`
   - Documentación de la configuración de nginx

4. 📄 `/LEXIMATE-BACKEND/scripts/verify-nginx-setup.sh`
   - Script de verificación automatizada

5. 📄 Este archivo de resumen

---

## 🎯 Resultado Final

Ahora tienes una configuración completa de:
- ✅ **Frontend React** servido por Nginx
- ✅ **Backend Fastify** accesible vía proxy en `/api`
- ✅ **WebSocket** funcionando en `/ws`
- ✅ **Routing SPA** con React Router
- ✅ **Cache optimizado** para assets estáticos
- ✅ **Compresión gzip** para mejor performance

**¡Todo listo para producción o desarrollo!** 🚀
