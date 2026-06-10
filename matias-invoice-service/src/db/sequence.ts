import { getInvoiceDbPool } from '@/db/pool';
import logger from '@/utils/logger';

const memoryLast = new Map<string, number>();

let sequenceTableReady = false;

async function ensureSequenceTable(): Promise<void> {
  const pool = getInvoiceDbPool();
  if (!pool || sequenceTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_sequence (
      id SERIAL PRIMARY KEY,
      prefix VARCHAR(32) NOT NULL UNIQUE,
      last_number INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  sequenceTableReady = true;
}

/**
 * Siguiente número de documento por prefijo. Persistido en la BD del micro (o memoria si no hay URL).
 */
export async function getNextDocumentNumber(prefix: string): Promise<string> {
  const pool = getInvoiceDbPool();

  if (pool) {
    await ensureSequenceTable();
    const result = await pool.query(
      `INSERT INTO invoice_sequence (prefix, last_number)
       VALUES ($1, 1)
       ON CONFLICT (prefix) DO UPDATE SET
         last_number = invoice_sequence.last_number + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING last_number`,
      [prefix],
    );
    const row = result.rows[0];
    if (row?.last_number == null) {
      throw new Error(`Failed to get next document number for prefix ${prefix}`);
    }
    return String(row.last_number);
  }

  const current = memoryLast.get(prefix) ?? 0;
  const next = current + 1;
  memoryLast.set(prefix, next);
  logger.warn(
    `Sequence for prefix "${prefix}" is in-memory only (set INVOICE_SERVICE_DATABASE_URL for durable numbering).`,
  );
  return String(next);
}
