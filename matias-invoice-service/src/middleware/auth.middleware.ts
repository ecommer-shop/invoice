import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/config/environment';
import logger from '@/utils/logger';

/**
 * Middleware para autenticar requests usando API Key
 */
export function authenticateRequest(request: NextRequest): { authenticated: boolean; error?: string } {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) {
    logger.warn('Request missing API key', {
      path: request.nextUrl.pathname,
      method: request.method,
    });
    return {
      authenticated: false,
      error: 'Missing X-API-Key header',
    };
  }

  if (apiKey !== config.vendure.apiKey) {
    logger.warn('Invalid API key', {
      path: request.nextUrl.pathname,
      method: request.method,
    });
    return {
      authenticated: false,
      error: 'Invalid API key',
    };
  }

  return { authenticated: true };
}

/**
 * Helper para crear respuesta de error de autenticación
 */
export function createAuthErrorResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 401 }
  );
}

