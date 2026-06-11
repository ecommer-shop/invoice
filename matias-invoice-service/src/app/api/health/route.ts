import { NextResponse } from 'next/server';
import { getInvoiceDbPool } from '@/db/pool';

/**
 * Health check endpoint
 * GET /api/health
 */
export async function GET() {
  const pool = getInvoiceDbPool();
  let persistence: 'postgres' | 'memory' | 'postgres_error' = 'memory';

  if (pool) {
    try {
      await pool.query('SELECT 1');
      persistence = 'postgres';
    } catch {
      persistence = 'postgres_error';
    }
  }

  return NextResponse.json({
    status: 'ok',
    service: 'matias-invoice-service',
    persistence,
    timestamp: new Date().toISOString(),
  });
}

