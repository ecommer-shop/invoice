import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';
import { CreateInvoiceDto } from '@/models/invoice.dto';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse, createValidationErrorResponse } from '@/middleware/error.middleware';
import { validateDto, getRequestBody } from '@/middleware/validation.middleware';
import { validateInvoiceByType } from '@/middleware/invoice-validation.middleware';
import { MATIAS_BEARER_TOKEN_HEADER, MATIAS_COMPANY_ID_HEADER } from '@/constants/matias-auth.constants';
import logger from '@/utils/logger';

const invoiceService = new InvoiceService();

/** Quita strings vacíos / null de campos opcionales que rompen class-validator. */
function sanitizeInvoiceBody(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  const optionalStrings = [
    'documentNumber',
    'matiasCompanyId',
    'resolutionNumber',
    'prefix',
    'notes',
    'date',
    'time',
  ] as const;
  for (const key of optionalStrings) {
    const value = next[key];
    if (value === null || value === undefined) {
      delete next[key];
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      delete next[key];
    }
  }
  return next;
}

/**
 * Crear una nueva factura
 * POST /api/invoices
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticación
    const auth = authenticateRequest(request);
    if (!auth.authenticated) {
      return createAuthErrorResponse(auth.error || 'Unauthorized');
    }

    // Validar y parsear body
    const rawBody = await getRequestBody(request);
    const matiasBearerToken = request.headers.get(MATIAS_BEARER_TOKEN_HEADER);
    const matiasCompanyIdHeader = request.headers.get(MATIAS_COMPANY_ID_HEADER)?.trim() || '';

    // Header gana sobre body: aplicar Company ID ANTES de validar tipo/flujo.
    const body = sanitizeInvoiceBody({
      ...(rawBody && typeof rawBody === 'object' ? rawBody : {}),
      ...(matiasCompanyIdHeader
        ? { matiasCompanyId: matiasCompanyIdHeader }
        : {}),
    });

    // Validar DTO
    const validation = await validateDto(CreateInvoiceDto, body);
    if (!validation.valid || !validation.dto) {
      const errors = validation.errors?.map((err) => ({
        property: err.property,
        constraints: err.constraints,
      }));
      return createValidationErrorResponse(errors);
    }

    if (matiasCompanyIdHeader) {
      validation.dto.matiasCompanyId = matiasCompanyIdHeader;
    }

    // Validación condicional según tipo de documento / perfil Matias
    const typeValidation = validateInvoiceByType(validation.dto);
    if (!typeValidation.valid) {
      return createValidationErrorResponse(typeValidation.errors);
    }

    // Crear factura
    logger.info('Received create invoice request', {
      orderCode: validation.dto.orderCode,
      hasMatiasCompanyId: !!validation.dto.matiasCompanyId?.trim(),
      hasMatiasBearerToken: !!matiasBearerToken?.trim(),
      hasDocumentNumber: !!validation.dto.documentNumber?.trim(),
    });
    const invoice = await invoiceService.createInvoice(validation.dto, {
      matiasBearerToken,
      matiasCompanyId: validation.dto.matiasCompanyId?.trim() || null,
    });

    return NextResponse.json(
      {
        success: true,
        data: invoice,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}

