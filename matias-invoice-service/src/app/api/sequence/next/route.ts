import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse } from '@/middleware/error.middleware';
import { getNextDocumentNumber } from '@/db/sequence';

/**
 * GET /api/sequence/next?prefix=LZT
 * Siguiente número de documento (persistido en la BD del micro).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (!auth.authenticated) {
      return createAuthErrorResponse(auth.error || 'Unauthorized');
    }

    const prefix = request.nextUrl.searchParams.get('prefix');
    if (!prefix?.trim()) {
      return createErrorResponse('query parameter "prefix" is required', 400);
    }

    const documentNumber = await getNextDocumentNumber(prefix.trim());

    return NextResponse.json({
      success: true,
      data: { prefix: prefix.trim(), documentNumber },
    });
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}
