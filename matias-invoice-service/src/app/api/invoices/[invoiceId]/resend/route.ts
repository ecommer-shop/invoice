import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse } from '@/middleware/error.middleware';
import { MATIAS_BEARER_TOKEN_HEADER, MATIAS_COMPANY_ID_HEADER } from '@/constants/matias-auth.constants';

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

    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = typeof body.email === 'string' ? body.email.trim() : undefined;
    const matiasBearerToken = request.headers.get(MATIAS_BEARER_TOKEN_HEADER);
    const matiasCompanyId = request.headers.get(MATIAS_COMPANY_ID_HEADER);
    const invoice = await invoiceService.resendInvoice(invoiceId, email, {
      matiasBearerToken,
      matiasCompanyId,
    });

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Invoice resent successfully',
    });
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}
