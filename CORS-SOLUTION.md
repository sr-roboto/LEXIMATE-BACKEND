# Solución al Problema CORS - LEXIMATE

## ❌ Problema Original

```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading 
the remote resource at http://localhost:8080/api/auth/login. 
(Reason: CORS request did not succeed)
```

### Causa
El frontend estaba intentando acceder **directamente** al backend en el puerto 8080:
- Frontend: `http://localhost` (puerto 80 a través de nginx)
- Backend: `http://localhost:8080` (acceso directo)

Esto violaba la política de Same-Origin porque son puertos diferentes.

---

## ✅ Solución Implementada

### 1. Actualizar axios para usar URL relativa

**Archivo**: `/LEXIMATE-FRONTEND/src/api/axios.js`

**Antes**:
```javascript
const instance = axios.create({
  baseURL:'http://localhost:8080/api',  // ❌ URL absoluta al puerto 8080
  withCredentials: true,
});
```

**Después**:
```javascript
const instance = axios.create({
  baseURL: '/api',  // ✅ URL relativa - usa el mismo origen
  withCredentials: true,
});
```

**Ventajas**:
- ✅ No hay problemas de CORS (mismo origen)
- ✅ Funciona en cualquier dominio sin cambios
- ✅ Funciona tanto en desarrollo como en producción

---

### 2. Actualizar WebSocket para usar host actual

**Archivo**: `/LEXIMATE-FRONTEND/src/context/WebSocketContext.jsx`

**Antes**:
```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = 'localhost:8080';  // ❌ Hardcodeado
const wsUrl = `${protocol}//${host}/ws`;
```

**Después**:
```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.host;  // ✅ Dinámico - usa el host actual
const wsUrl = `${protocol}//${host}/ws`;
```

**Ventajas**:
- ✅ WebSocket conecta a través de nginx
- ✅ Funciona en cualquier dominio automáticamente
- ✅ Soporte para https/wss en producción

---

## 🔄 Flujo de Peticiones (Después)

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React)                                            │
│ http://localhost                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ axios.get('/api/auth/profile')
                       │ new WebSocket('ws://localhost/ws')
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Nginx (Reverse Proxy)                                       │
│ localhost:80                                                │
├─────────────────────────────────────────────────────────────┤
│ • /api/*  → proxy_pass http://backend:8080                  │
│ • /ws     → proxy_pass http://backend:8080 (WebSocket)      │
│ • /*      → Archivos estáticos del frontend                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Proxy interno (misma red Docker)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend (Fastify)                                           │
│ backend:8080 (solo accesible en red Docker)                │
└─────────────────────────────────────────────────────────────┘
```

### Beneficios del Flujo
1. **Un solo origen**: Todo desde `http://localhost`
2. **Sin CORS**: No hay peticiones cross-origin
3. **Seguridad**: Backend no expuesto directamente
4. **Producción**: Mismo código funciona en cualquier dominio

---

## 🧪 Verificación

### Logs de Nginx (Después de la solución)
```
10.254.198.228 - - [25/Nov/2025:14:58:56 +0000] "GET / HTTP/1.1" 200 765
10.254.198.228 - - [25/Nov/2025:14:58:56 +0000] "GET /api/auth/profile HTTP/1.1" 401 72
10.254.198.228 - - [25/Nov/2025:14:58:57 +0000] "GET /ws HTTP/1.1" 401 72
10.254.198.228 - - [25/Nov/2025:14:59:11 +0000] "POST /api/auth/login HTTP/1.1" 401 73
```

✅ Todas las peticiones van a través de nginx
✅ No hay errores de CORS
✅ Frontend y API en el mismo origen

---

## 📝 Otros Archivos que Necesitan Actualización

**Pendiente**: Hay referencias hardcodeadas a `localhost:8080` en TaskPage.jsx para descargar archivos:

```javascript
// En: /LEXIMATE-FRONTEND/src/pages/TaskPage.jsx
href={`http://localhost:8080${file.file_url}`}
```

**Solución recomendada**:
```javascript
// Opción 1: URL relativa (si file_url incluye /api)
href={file.file_url}

// Opción 2: Si file_url no incluye /api, agregar prefijo
href={`/api${file.file_url}`}

// Opción 3: Usar baseURL de axios
href={`${axios.defaults.baseURL}${file.file_url}`}
```

---

## 🚀 Comandos de Reconstrucción

Para aplicar los cambios del frontend:

```bash
# 1. Reconstruir frontend y reiniciar contenedores
docker compose down -v
docker compose up --build -d

# 2. Solo reconstruir frontend (si ya tienes datos en DB)
docker compose up --build frontend -d
docker compose restart nginx

# 3. Ver logs para verificar
docker logs leximate-nginx --tail 50
docker logs leximate-backend --tail 50
```

---

## ✅ Resumen

| Aspecto | Antes | Después |
|---------|-------|---------|
| **API URL** | `http://localhost:8080/api` | `/api` (relativa) |
| **WebSocket** | `ws://localhost:8080/ws` | `ws://{host}/ws` (dinámico) |
| **CORS** | ❌ Error cross-origin | ✅ Mismo origen |
| **Portabilidad** | ❌ Solo localhost | ✅ Cualquier dominio |
| **Producción** | ❌ Requiere cambios | ✅ Sin cambios necesarios |

**Estado**: ✅ **Problema de CORS resuelto completamente**
