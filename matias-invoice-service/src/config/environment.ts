import dotenv from 'dotenv';

dotenv.config();

export interface EnvironmentConfig {
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
   * Base de datos
   */
  databaseUrl: string | null;
  databaseSsl: boolean;
}

let cachedConfig: EnvironmentConfig | null = null;

function isBuildTime(): boolean {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return true;
  }
  if (process.env.npm_lifecycle_event === 'build') {
    return true;
  }
  return false;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value ?? '';
}

function resolveDatabaseUrl(): string | null {
  const direct =
    process.env.INVOICE_SERVICE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (direct) {
    return direct;
  }

  const host = process.env.DB_INVOICE_HOST?.trim();
  if (!host) {
    return null;
  }

  const port = process.env.DB_INVOICE_PORT?.trim() || '5432';
  const user = process.env.DB_INVOICE_USERNAME?.trim() || process.env.DB_INVOICE_USER?.trim() || 'postgres';
  const password = process.env.DB_INVOICE_PASSWORD?.trim() ?? '';
  const database =
    process.env.DB_INVOICE_NAME?.trim() ||
    process.env.DB_INVOICE_DATABASE?.trim() ||
    'railway';

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
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

  const prefix = 'VENDURE_SERVICE_API_KEY=';
  if (raw.startsWith(prefix)) {
    return raw.slice(prefix.length);
  }

  return raw;
}

function buildStubConfig(): EnvironmentConfig {
  const databaseUrl = resolveDatabaseUrl();

  return {
    port: parseInt(process.env.PORT || '3010', 10),
    nodeEnv: process.env.NODE_ENV || 'production',
    matias: {
      apiUrl: process.env.MATIAS_API_URL || 'https://placeholder.local',
      email: process.env.MATIAS_EMAIL || 'build@placeholder.local',
      password: process.env.MATIAS_PASSWORD || 'build-placeholder',
    },
    vendure: {
      apiKey: normalizeApiKey(process.env.VENDURE_SERVICE_API_KEY || 'build-placeholder'),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
    databaseUrl,
    databaseSsl: resolveDatabaseSsl(databaseUrl),
  };
}

function loadConfig(): EnvironmentConfig {
  const databaseUrl = resolveDatabaseUrl();

  return {
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
    databaseUrl,
    databaseSsl: resolveDatabaseSsl(databaseUrl),
  };
}

/**
 * Configuración lazy: no valida secretos durante next build.
 */
export function getConfig(): EnvironmentConfig {
  if (!cachedConfig) {
    cachedConfig = isBuildTime() ? buildStubConfig() : loadConfig();
  }
  return cachedConfig;
}

function readNestedConfig(
  root: keyof EnvironmentConfig,
  nested?: string,
): unknown {
  const value = getConfig()[root];
  if (nested && value && typeof value === 'object') {
    return (value as Record<string, unknown>)[nested];
  }
  return value;
}

/** Compatibilidad con imports existentes */
export const config = new Proxy({} as EnvironmentConfig, {
  get(_target, prop: string) {
    if (prop === 'matias' || prop === 'vendure' || prop === 'logging') {
      return new Proxy(
        {},
        {
          get(_nestedTarget, nestedProp: string) {
            return readNestedConfig(prop as keyof EnvironmentConfig, nestedProp);
          },
        },
      );
    }
    return getConfig()[prop as keyof EnvironmentConfig];
  },
});

export function isProduction(): boolean {
  return getConfig().nodeEnv === 'production';
}

export function isDevelopment(): boolean {
  return getConfig().nodeEnv === 'development';
}
