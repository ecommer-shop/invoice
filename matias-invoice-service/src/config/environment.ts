import dotenv from 'dotenv';

dotenv.config();

interface EnvironmentConfig {
  port: number;
  nodeEnv: string;
  matias: {
    apiUrl: string;
    email: string;
    password: string;
  };
  vendure: {
    apiKey: string;
  };
  logging: {
    level: string;
  };
  /**
   * Base de datos **solo del microservicio** (no usar el `DATABASE_URL` de Vendure/shop).
   * En Railway: crea un Postgres aparte y pega aquí su URL.
   */
  databaseUrl: string | null;
  databaseSsl: boolean;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value!;
}

function resolveDatabaseSsl(databaseUrl: string | null): boolean {
  if (process.env.INVOICE_SERVICE_DB_SSL === 'true') {
    return true;
  }
  if (!databaseUrl) {
    return false;
  }
  const lower = databaseUrl.toLowerCase();
  return (
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-full') ||
    lower.includes('railway.app') ||
    lower.includes('railway.internal')
  );
}

function normalizeApiKey(raw: string): string {
  if (!raw) return raw;

  // Si el valor empieza con "VENDURE_SERVICE_API_KEY=" nos quedamos solo con la parte derecha
  const prefix = 'VENDURE_SERVICE_API_KEY=';
  if (raw.startsWith(prefix)) {
    return raw.slice(prefix.length);
  }

  return raw;
}

export const config: EnvironmentConfig = {
  port: parseInt(getEnvVar('PORT', '3010'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  matias: {
    apiUrl: getEnvVar('MATIAS_API_URL'),
    email: getEnvVar('MATIAS_EMAIL'),
    password: getEnvVar('MATIAS_PASSWORD'),
  },
  vendure: {
    apiKey: normalizeApiKey(getEnvVar('VENDURE_SERVICE_API_KEY')),
  },
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
  },
  databaseUrl: process.env.INVOICE_SERVICE_DATABASE_URL?.trim() || null,
  databaseSsl: resolveDatabaseSsl(
    process.env.INVOICE_SERVICE_DATABASE_URL?.trim() || null,
  ),
};

export const isProduction = config.nodeEnv === 'production';
export const isDevelopment = config.nodeEnv === 'development';
