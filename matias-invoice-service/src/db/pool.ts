import { Pool, type PoolConfig } from 'pg';
import { config } from '@/config/environment';

let pool: Pool | null = null;

/**
 * Pool de Postgres **exclusivo del microservicio**.
 * Configura `INVOICE_SERVICE_DATABASE_URL` (no reutilizar el `DATABASE_URL` de Vendure).
 */
export function getInvoiceDbPool(): Pool | null {
  if (!config.databaseUrl) {
    return null;
  }
  if (!pool) {
    const cfg: PoolConfig = {
      connectionString: config.databaseUrl,
      max: 10,
    };
    if (config.databaseSsl) {
      cfg.ssl = { rejectUnauthorized: false };
    }
    pool = new Pool(cfg);
  }
  return pool;
}
