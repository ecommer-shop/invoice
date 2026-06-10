# Despliegue en Railway — matias-invoice-service

Guía para pasar de base de datos local a un entorno compartido en Railway.

## Arquitectura

```
┌─────────────────┐     HTTP (X-API-Key)     ┌──────────────────────────┐
│  Vendure (shop) │ ───────────────────────► │  matias-invoice-service  │
│  Railway / otro │                          │  (Next.js API)           │
└────────┬────────┘                          └────────────┬─────────────┘
         │                                                │
         │ DATABASE_URL                                   │ INVOICE_SERVICE_DATABASE_URL
         ▼                                                ▼
┌─────────────────┐                          ┌──────────────────────────┐
│  PostgreSQL     │                          │  PostgreSQL (dedicado)   │
│  de Vendure     │   ← NO compartir →       │  solo facturas Matias    │
└─────────────────┘                          └──────────────────────────┘
```

**Importante:** el microservicio usa su **propia** base de datos. No reutilices el `DATABASE_URL` del shop. Las tablas (`matias_invoice_record`, `invoice_sequence`) se crean solas al primer uso.

---

## Paso 1 — Subir el código a GitHub

Asegúrate de que `matias-invoice-service/` esté en el repositorio que Railway va a conectar (por ejemplo dentro de `shop/matias-invoice-service`).

---

## Paso 2 — Crear el proyecto en Railway

1. Entra en [railway.app](https://railway.app) → **New Project**.
2. Elige **Deploy from GitHub repo** y selecciona tu repositorio.
3. Railway creará un servicio. Ábrelo y ve a **Settings**:
   - **Root Directory:** `matias-invoice-service`  
     (o `shop/matias-invoice-service` si el repo raíz es `GitHub` y el shop está en subcarpeta).
   - **Watch Paths:** `matias-invoice-service/**` (opcional, evita redeploys del shop).

Railway detectará `railway.toml` y usará Nixpacks (Node.js). **No necesitas Docker** para el despliegue normal.

---

## Paso 3 — Crear PostgreSQL dedicado

1. En el mismo proyecto Railway: **+ New** → **Database** → **PostgreSQL**.
2. Espera a que el servicio Postgres quede **Active**.
3. En el servicio Postgres → pestaña **Variables** → copia `DATABASE_URL` (o usa referencia de Railway).

---

## Paso 4 — Variables de entorno del microservicio

En el servicio **matias-invoice-service** → **Variables**, agrega:

| Variable | Valor | Notas |
|----------|-------|-------|
| `NODE_ENV` | `production` | Obligatorio |
| `MATIAS_API_URL` | `https://api-v2.matias-api.com/api/ubl2.1` | API Matias |
| `MATIAS_EMAIL` | tu email Matias | Credenciales DIAN/Matias |
| `MATIAS_PASSWORD` | tu contraseña Matias | |
| `VENDURE_SERVICE_API_KEY` | clave larga aleatoria | Genera una segura (ej. `openssl rand -hex 32`) |
| `INVOICE_SERVICE_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Referencia al Postgres del paso 3 |
| `LOG_LEVEL` | `info` | Opcional |

### Referenciar la BD en Railway

En **Variables** del microservicio:

```
INVOICE_SERVICE_DATABASE_URL=${{NOMBRE_DEL_SERVICIO_POSTGRES.DATABASE_URL}}
```

Railway muestra las referencias al escribir `${{` en el editor de variables. Elige el servicio PostgreSQL que creaste.

Si la conexión falla por SSL, agrega también:

```
INVOICE_SERVICE_DB_SSL=true
```

(o añade `?sslmode=require` al final de la URL).

**No definas `PORT` manualmente** — Railway la asigna automáticamente.

---

## Paso 5 — Desplegar

1. **Deploy** → Railway ejecutará `npm ci && npm run build` y luego `npm start`.
2. Cuando el deploy termine, abre **Settings** → **Networking** → **Generate Domain**.
3. Obtendrás una URL pública, por ejemplo:  
   `https://matias-invoice-service-production.up.railway.app`

### Verificar que funciona

```bash
curl https://TU-DOMINIO.up.railway.app/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "matias-invoice-service",
  "persistence": "postgres",
  "timestamp": "..."
}
```

Si `persistence` es `"memory"` o `"postgres_error"`, revisa `INVOICE_SERVICE_DATABASE_URL` y SSL.

---

## Paso 6 — Conectar Vendure (shop)

En el servicio **shop** en Railway (o en tu `.env` de stage/prod), actualiza:

```env
INVOICE_SERVICE_URL=https://TU-DOMINIO.up.railway.app/api
INVOICE_SERVICE_API_KEY=la-misma-clave-que-VENDURE_SERVICE_API_KEY
```

Redeploy el shop después de cambiar estas variables.

| Microservicio | Shop (Vendure) |
|---------------|----------------|
| `VENDURE_SERVICE_API_KEY` | `INVOICE_SERVICE_API_KEY` |
| URL base + `/api` | `INVOICE_SERVICE_URL` |

---

## Paso 7 — Probar facturación end-to-end

1. En el dashboard Vendure: **Ventas → Matias por tienda** — configura token, prefijo y resolución del canal.
2. Activa facturación en el canal.
3. Completa un pedido de prueba hasta estado **PaymentSettled**.
4. Revisa logs del microservicio en Railway y `GET /api/health` con `persistence: "postgres"`.

---

## Desarrollo local con la misma BD (opcional)

Para usar la BD de Railway desde tu máquina:

1. En Postgres Railway → **Connect** → copia la URL pública.
2. En `matias-invoice-service/.env`:

```env
INVOICE_SERVICE_DATABASE_URL=postgresql://...@...railway.app:5432/railway
INVOICE_SERVICE_DB_SSL=true
```

3. `npm run dev` — el esquema se crea automáticamente.

---

## Docker (opcional)

Railway con Nixpacks es suficiente. Si prefieres Docker:

1. En el servicio → **Settings** → **Builder** → **Dockerfile**.
2. El `Dockerfile` del proyecto ya está configurado (`output: standalone`).

Build local:

```bash
cd matias-invoice-service
docker build -t matias-invoice-service .
docker run -p 3010:3010 --env-file .env matias-invoice-service
```

---

## Resolución de problemas

| Síntoma | Solución |
|---------|----------|
| Build falla por variables faltantes | Las variables Matias/API key solo son obligatorias en **runtime**, no en build. Si falla, revisa logs. |
| `persistence: "postgres_error"` | SSL: `INVOICE_SERVICE_DB_SSL=true` o `?sslmode=require` en la URL. |
| Vendure no llama al micro | `INVOICE_SERVICE_URL` debe terminar en `/api`. Misma API key en ambos servicios. |
| 401 en el micro | `X-API-Key` del shop ≠ `VENDURE_SERVICE_API_KEY` del micro. |
| Secuencia de facturas se reinicia | Sin BD persistente; confirma `persistence: "postgres"` en health. |

---

## Checklist rápido

- [ ] Servicio Railway con Root Directory = `matias-invoice-service`
- [ ] PostgreSQL **separado** del shop
- [ ] `INVOICE_SERVICE_DATABASE_URL` apuntando al Postgres del micro
- [ ] Dominio público generado
- [ ] `/api/health` → `persistence: "postgres"`
- [ ] Shop con `INVOICE_SERVICE_URL` y `INVOICE_SERVICE_API_KEY` actualizados
- [ ] Redeploy del shop
