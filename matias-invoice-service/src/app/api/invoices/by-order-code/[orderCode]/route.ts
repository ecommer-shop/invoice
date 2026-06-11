import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse } from '@/middleware/error.middleware';

const invoiceService = new InvoiceService();

/**
 * Obtener factura por código de orden
 * GET /api/invoices/by-order-code/:orderCode
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> },
) {
  try {
    const auth = authenticateRequest(request);
    if (!auth.authenticated) {
      return createAuthErrorResponse(auth.error || 'Unauthorized');
    }

    const { orderCode } = await params;
    if (!orderCode) {
      return createErrorResponse('orderCode is required', 400);
    }

    const invoice = await invoiceService.getInvoiceByOrderCode(orderCode);
    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice not found',
          message: `No invoice found for order code: ${orderCode}`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}

