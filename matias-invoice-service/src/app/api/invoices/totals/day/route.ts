import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse } from '@/middleware/error.middleware';
import { InvoiceService } from '@/services/invoice.service';

const invoiceService = new InvoiceService();

/** GET /api/invoices/totals/day?dateFrom=&dateTo= */
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (!auth.authenticated) {
      return createAuthErrorResponse(auth.error || 'Unauthorized');
    }

    const sp = request.nextUrl.searchParams;
    const dateFromStr = sp.get('dateFrom');
    const dateToStr = sp.get('dateTo');
    if (!dateFromStr || !dateToStr) {
      return createErrorResponse('dateFrom and dateTo are required', 400);
    }

    const rows = await invoiceService.getTotalsByDay(
      new Date(dateFromStr),
      new Date(dateToStr),
      sp.get('prefix') || undefined,
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}
