import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse } from '@/middleware/error.middleware';

const invoiceService = new InvoiceService();

/**
 * Reenviar una factura
 * POST /api/invoices/:invoiceId/resend
 */
export async function POST(
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

    const invoice = await invoiceService.resendInvoice(invoiceId);

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Invoice resent successfully',
    });
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}
