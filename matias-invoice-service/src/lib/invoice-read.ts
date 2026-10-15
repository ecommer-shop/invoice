import { getInvoiceDbPool } from '@/db/pool';
import { InvoiceRepository } from '@/db/invoice-repository';

/** Repositorio para listados/totales; null si no hay BD configurada. */
export async function getInvoiceReadRepository(): Promise<InvoiceRepository | null> {
  const pool = getInvoiceDbPool();
  if (!pool) return null;
  const repo = new InvoiceRepository(pool);
  await repo.ensureSchema();
  return repo;
}
