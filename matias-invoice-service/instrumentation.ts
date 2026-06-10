/**
 * Validación al arrancar el servidor (Next.js instrumentation hook).
 */
export async function register() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const required = [
    'MATIAS_API_URL',
    'MATIAS_EMAIL',
    'MATIAS_PASSWORD',
    'VENDURE_SERVICE_API_KEY',
    'INVOICE_SERVICE_DATABASE_URL',
  ] as const;

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Variables de entorno obligatorias en producción: ${missing.join(', ')}`,
    );
  }
}
