import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse } from '@/middleware/error.middleware';

const invoiceService = new InvoiceService();

/**
 * Obtener estado de una factura
 * GET /api/invoices/:invoiceId/status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    // Autenticación
    const auth = authenticateRequest(request);
    if (!auth.authenticated) {
      return createAuthErrorResponse(auth.error || 'Unauthorized');
    }

    const { invoiceId } = await params;

    if (!invoiceId) {
      return createErrorResponse('Invoice ID is required', 400);
    }

    const status = await invoiceService.getInvoiceStatus(invoiceId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}
