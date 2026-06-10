import { NextResponse } from 'next/server';
import logger from '@/utils/logger';

export interface ApiError {
  success: false;
  error: string;
  message?: string;
  details?: any;
}

/**
 * Crea una respuesta de error estandarizada
 */
export function createErrorResponse(
  error: Error | string,
  statusCode: number = 500,
  details?: any
): NextResponse<ApiError> {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorName = typeof error === 'string' ? 'Error' : error.name;

  logger.error('API Error:', {
    message: errorMessage,
    name: errorName,
    statusCode,
    details,
    stack: typeof error === 'object' ? error.stack : undefined,
  });

  return NextResponse.json(
    {
      success: false,
      error: errorName,
      message: errorMessage,
      ...(details && { details }),
    },
    { status: statusCode }
  );
}

/**
 * Maneja errores de validación
 */
export function createValidationErrorResponse(errors: any): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: 'ValidationError',
      message: 'Validation failed',
      details: errors,
    },
    { status: 400 }
  );
}

