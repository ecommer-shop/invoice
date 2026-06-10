import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/middleware/auth.middleware';
import { createErrorResponse } from '@/middleware/error.middleware';
import { getInvoiceReadRepository } from '@/lib/invoice-read';

/**
 * GET /api/invoices/list?dateFrom=&dateTo=&customerDni=&status=&orderCode=&take=&skip=
 */
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
          message: 'Set INVOICE_SERVICE_DATABASE_URL to enable invoice listing.',
        },
        { status: 503 },
      );
    }

    const sp = request.nextUrl.searchParams;
    const dateFrom = sp.get('dateFrom') ? new Date(sp.get('dateFrom')!) : undefined;
    const dateTo = sp.get('dateTo') ? new Date(sp.get('dateTo')!) : undefined;
    const customerDni = sp.get('customerDni') || undefined;
    const status = sp.get('status') || undefined;
    const orderCode = sp.get('orderCode') || undefined;
    const take = sp.get('take') ? parseInt(sp.get('take')!, 10) : undefined;
    const skip = sp.get('skip') ? parseInt(sp.get('skip')!, 10) : undefined;

    const result = await repo.listInvoices(
      { dateFrom, dateTo, customerDni, status, orderCode },
      { take, skip },
    );

    return NextResponse.json({
      success: true,
      data: {
        items: result.items.map((row) => ({
          id: row.id,
          orderCode: row.orderCode,
          prefix: row.prefix,
          documentNumber: row.documentNumber,
          typeDocumentId: row.typeDocumentId,
          operationTypeId: row.operationTypeId,
          status: row.status,
          statusMessage: row.statusMessage,
          customerName: row.customerName,
          customerDni: row.customerDni,
          customerEmail: row.customerEmail,
          subtotal: row.subtotal,
          taxTotal: row.taxTotal,
          total: row.total,
          currencyCode: row.currencyCode,
          pdfUrl: row.pdfUrl,
          xmlUrl: row.xmlUrl,
          createdAt: row.createdAt.toISOString(),
        })),
        total: result.total,
      },
    });
  } catch (error: any) {
    return createErrorResponse(error, error.statusCode || 500);
  }
}
