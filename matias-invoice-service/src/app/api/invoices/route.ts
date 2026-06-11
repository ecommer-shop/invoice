import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';
import { CreateInvoiceDto } from '@/models/invoice.dto';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse, createValidationErrorResponse } from '@/middleware/error.middleware';
import { validateDto, getRequestBody } from '@/middleware/validation.middleware';
import { validateInvoiceByType } from '@/middleware/invoice-validation.middleware';

const invoiceService = new InvoiceService();

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
    const body = await getRequestBody(request);

    // Validar DTO
    const validation = await validateDto(CreateInvoiceDto, body);
    if (!validation.valid || !validation.dto) {
      const errors = validation.errors?.map((err) => ({
        property: err.property,
        constraints: err.constraints,
      }));
      return createValidationErrorResponse(errors);
    }

    // Validación condicional según tipo de documento
    const typeValidation = validateInvoiceByType(validation.dto);
    if (!typeValidation.valid) {
      return createValidationErrorResponse(typeValidation.errors);
    }

    // Crear factura
    const invoice = await invoiceService.createInvoice(validation.dto);

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

