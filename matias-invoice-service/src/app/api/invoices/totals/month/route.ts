import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse } from '@/middleware/error.middleware';
import { getInvoiceReadRepository } from '@/lib/invoice-read';

/** GET /api/invoices/totals/month?dateFrom=&dateTo= */
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (!auth.authenticated) {
      return createAuthErrorResponse(auth.error || 'Unauthorized');
    }

    const repo = await getInvoiceReadRepository();
    if (!repo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database not configured',
          message: 'Set INVOICE_SERVICE_DATABASE_URL.',
        },
        { status: 503 },
      );
    }

    const sp = request.nextUrl.searchParams;
    const dateFromStr = sp.get('dateFrom');
    const dateToStr = sp.get('dateTo');
    if (!dateFromStr || !dateToStr) {
      return createErrorResponse('dateFrom and dateTo are required', 400);
    }

    const rows = await repo.getTotalsByMonth(new Date(dateFromStr), new Date(dateToStr));

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}
