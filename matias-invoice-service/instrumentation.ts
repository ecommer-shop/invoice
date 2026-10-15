/**
 * Validación al arrancar el servidor (runtime).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const required = [
    'MATIAS_API_URL',
    'MATIAS_EMAIL',
    'MATIAS_PASSWORD',
    'VENDURE_SERVICE_API_KEY',
  ] as const;

  const missing: string[] = required.filter((key) => !process.env[key]?.trim());

  const hasDatabase =
    Boolean(process.env.DB_INVOICE_HOST?.trim());

  if (!hasDatabase) {
    missing.push('INVOICE_SERVICE_DATABASE_URL (o DB_INVOICE_HOST + credenciales)');
  }

  if (missing.length > 0) {
    throw new Error(
      `Variables de entorno obligatorias en producción: ${missing.join(', ')}. ` +
        'Para la BD usa INVOICE_SERVICE_DATABASE_URL, DATABASE_URL (Postgres Railway) o DB_INVOICE_HOST + credenciales.',
    );
  }
}
