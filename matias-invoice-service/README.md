# Matias Invoice Service

Microservicio de facturación electrónica con Matias para integración con Vendure.

## 🚀 Características

- API REST completa para gestión de facturas
- Integración con Matias API
- Autenticación mediante API Key
- Validación de datos con class-validator
- Manejo centralizado de errores
- Logging estructurado con Winston

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Credenciales de Matias API
- Certificado digital DIAN configurado en Matias

## 🔧 Instalación

1. Instalar dependencias:
```bash
npm install
# o
yarn install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales (ver `.env.example`):
```env
PORT=3010
NODE_ENV=development
MATIAS_API_URL=https://api-v2.matias-api.com/api/ubl2.1
MATIAS_EMAIL=tu-email@ejemplo.com
MATIAS_PASSWORD=tu-contraseña
VENDURE_SERVICE_API_KEY=tu-api-key-secreta
LOG_LEVEL=info
# Base de datos PROPIA del microservicio (no la misma que Vendure/shop):
INVOICE_SERVICE_DATABASE_URL=postgresql://...
# INVOICE_SERVICE_DB_SSL=true
```

**Nota importante**: Las credenciales `MATIAS_EMAIL` y `MATIAS_PASSWORD` son las que recibiste al registrarte en la API de Matias. Si aún no te has registrado, debes hacerlo primero en `{{URL}}/register` o a través del formulario web.

3. Ejecutar en desarrollo:
```bash
npm run dev
```

El servicio estará disponible en `http://localhost:3010` (o el `PORT` que definas). En Vendure, `INVOICE_SERVICE_URL` debe apuntar a la misma base, p. ej. `http://localhost:3010/api`.

## 📚 API Endpoints

### Health Check
```
GET /api/health
```

### Siguiente número de documento (secuencia en la BD del micro)
Vendure llama esto antes de `POST /invoices`; no se guarda secuencia en la BD del shop.
```
GET /api/sequence/next?prefix=LZT
Headers:
  X-API-Key: your-api-key
```
Respuesta: `{ "success": true, "data": { "prefix": "LZT", "documentNumber": "2840" } }`

### Listado y totales (requieren `INVOICE_SERVICE_DATABASE_URL`)
```
GET /api/invoices/list?dateFrom=&dateTo=&customerDni=&status=&orderCode=&take=&skip=
GET /api/invoices/totals/day?dateFrom=&dateTo=
GET /api/invoices/totals/month?dateFrom=&dateTo=
Headers:
  X-API-Key: your-api-key
```

### Crear Factura
```
POST /api/invoices
Headers:
  X-API-Key: your-api-key
  Content-Type: application/json

Body:
{
  "orderCode": "ORDER123",
  "customer": {
    "name": "Juan Pérez",
    "dni": "1234567890",
    "email": "juan@example.com",
    "address": "Calle 123 #45-67",
    "cityId": 836
  },
  "items": [
    {
      "description": "Producto 1",
      "quantity": 2,
      "unitPrice": 10000,
      "taxRate": 19
    }
  ],
  "totalAmount": 23800,
  "taxAmount": 3800,
  "paymentMethod": "tarjeta"
}
```

### Obtener Factura por Código de Orden
```
GET /api/invoices/:orderCode
Headers:
  X-API-Key: your-api-key
```

### Obtener Estado de Factura
```
GET /api/invoices/:invoiceId/status
Headers:
  X-API-Key: your-api-key
```

### Reenviar Factura
```
POST /api/invoices/:invoiceId/resend
Headers:
  X-API-Key: your-api-key
```

## 🔐 Autenticación

Todas las requests a la API (excepto `/api/health`) requieren el header:
```
X-API-Key: your-api-key
```

La API Key debe coincidir con `VENDURE_SERVICE_API_KEY` en las variables de entorno.

## 🔌 Integración con Vendure

En Vendure, crea un servicio cliente que llame a este microservicio:

```typescript
// Ejemplo en Vendure
import axios from 'axios';

const invoiceService = axios.create({
  baseURL: 'http://localhost:3010/api',
  headers: {
    'X-API-Key': process.env.VENDURE_SERVICE_API_KEY,
    'Content-Type': 'application/json',
  },
});

// Crear factura cuando una orden se complete
await invoiceService.post('/invoices', {
  orderCode: order.code,
  customer: { /* ... */ },
  items: [ /* ... */ ],
});
```

## 🐳 Docker

Para ejecutar con Docker:

```bash
docker build -t matias-invoice-service .
docker run -p 3010:3010 --env-file .env matias-invoice-service
```

## 📝 Notas Importantes

1. **Token de Matias**: El servicio maneja automáticamente la autenticación y renovación del token de Matias. El token se obtiene mediante login con email/password y tiene validez de 1 año.

2. **Persistencia y base de datos**:
   - **Producción**: define `INVOICE_SERVICE_DATABASE_URL` con un **PostgreSQL dedicado al microservicio** (no reutilices el `DATABASE_URL` de Vendure/shop). El servicio crea la tabla `matias_invoice_record` al arrancar.
   - **Desarrollo**: si no defines esa variable, se usa almacenamiento en memoria (con advertencia en logs).

3. **Endpoints de Matias**: Los endpoints de la API de Matias en el código tienen marcadores `TODO`. Debes ajustarlos según la documentación real de Matias.

4. **Transformación de Datos**: La función `transformToMatiasRequest` debe ser completada según la especificación completa de la API de Matias.

## 🛠️ Desarrollo

- **Build**: `npm run build`
- **Start (producción)**: `npm start`
- **Type Check**: `npm run type-check`
- **Lint**: `npm run lint`

## 📄 Licencia

Private - Uso interno

