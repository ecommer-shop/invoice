import type { Pool } from 'pg';
import { InvoiceStatus } from '@/types/invoice.types';

export interface InvoiceMetadata {
  id: string;
  orderCode: string;
  prefix: string;
  documentNumber: string;
  status: InvoiceStatus;
  cufe?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  issuedAt?: Date;
  error?: string;
  createdAt: Date;
  /** Campos de reporte / UI (opcionales) */
  typeDocumentId?: number;
  operationTypeId?: number;
  statusMessage?: string | null;
  customerName?: string | null;
  customerDni?: string | null;
  customerEmail?: string | null;
  subtotal?: string | null;
  taxTotal?: string | null;
  total?: string | null;
  currencyCode?: string | null;
  matiasInvoiceId?: string | null;
  matiasInvoiceNumber?: string | null;
}

export interface InvoiceListRow {
  id: string;
  orderCode: string;
  prefix: string;
  documentNumber: string;
  typeDocumentId: number;
  operationTypeId: number;
  status: string;
  statusMessage: string | null;
  customerName: string;
  customerDni: string;
  customerEmail: string | null;
  subtotal: string;
  taxTotal: string;
  total: string;
  currencyCode: string;
  pdfUrl: string | null;
  xmlUrl: string | null;
  createdAt: Date;
}

const TABLE = 'matias_invoice_record';

export class InvoiceRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id TEXT PRIMARY KEY,
        order_code VARCHAR(255) NOT NULL,
        prefix VARCHAR(32) NOT NULL,
        document_number VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL,
        cufe TEXT,
        pdf_url TEXT,
        xml_url TEXT,
        issued_at TIMESTAMPTZ,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_matias_invoice_order_code
      ON ${TABLE} (order_code);
    `);

    const alters = [
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS type_document_id INTEGER`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS operation_type_id INTEGER`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS status_message TEXT`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS customer_dni VARCHAR(64)`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255)`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS subtotal VARCHAR(32)`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS tax_total VARCHAR(32)`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS total VARCHAR(32)`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS currency_code VARCHAR(8)`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS matias_invoice_id VARCHAR(255)`,
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS matias_invoice_number VARCHAR(255)`,
    ];
    for (const sql of alters) {
      await this.pool.query(sql);
    }
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_matias_invoice_customer_dni
      ON ${TABLE} (customer_dni);
    `);
  }

  private rowToMetadata(row: Record<string, unknown>): InvoiceMetadata {
    return {
      id: row.id as string,
      orderCode: row.order_code as string,
      prefix: row.prefix as string,
      documentNumber: row.document_number as string,
      status: row.status as InvoiceStatus,
      cufe: (row.cufe as string) || undefined,
      pdfUrl: (row.pdf_url as string) || undefined,
      xmlUrl: (row.xml_url as string) || undefined,
      issuedAt: row.issued_at ? new Date(row.issued_at as string) : undefined,
      error: (row.error as string) || undefined,
      createdAt: new Date(row.created_at as string),
      typeDocumentId: row.type_document_id != null ? Number(row.type_document_id) : undefined,
      operationTypeId: row.operation_type_id != null ? Number(row.operation_type_id) : undefined,
      statusMessage: (row.status_message as string) ?? null,
      customerName: (row.customer_name as string) ?? null,
      customerDni: (row.customer_dni as string) ?? null,
      customerEmail: (row.customer_email as string) ?? null,
      subtotal: (row.subtotal as string) ?? null,
      taxTotal: (row.tax_total as string) ?? null,
      total: (row.total as string) ?? null,
      currencyCode: (row.currency_code as string) ?? null,
      matiasInvoiceId: (row.matias_invoice_id as string) ?? null,
      matiasInvoiceNumber: (row.matias_invoice_number as string) ?? null,
    };
  }

  async insert(meta: InvoiceMetadata): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${TABLE} (
        id, order_code, prefix, document_number, status,
        cufe, pdf_url, xml_url, issued_at, error, created_at, updated_at,
        type_document_id, operation_type_id, status_message,
        customer_name, customer_dni, customer_email,
        subtotal, tax_total, total, currency_code,
        matias_invoice_id, matias_invoice_number
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24
      )`,
      [
        meta.id,
        meta.orderCode,
        meta.prefix,
        meta.documentNumber,
        meta.status,
        meta.cufe ?? null,
        meta.pdfUrl ?? null,
        meta.xmlUrl ?? null,
        meta.issuedAt ?? null,
        meta.error ?? null,
        meta.createdAt,
        new Date(),
        meta.typeDocumentId ?? null,
        meta.operationTypeId ?? null,
        meta.statusMessage ?? null,
        meta.customerName ?? null,
        meta.customerDni ?? null,
        meta.customerEmail ?? null,
        meta.subtotal ?? null,
        meta.taxTotal ?? null,
        meta.total ?? null,
        meta.currencyCode ?? null,
        meta.matiasInvoiceId ?? null,
        meta.matiasInvoiceNumber ?? null,
      ],
    );
  }

  async update(meta: InvoiceMetadata): Promise<void> {
    await this.pool.query(
      `UPDATE ${TABLE} SET
        order_code = $2,
        prefix = $3,
        document_number = $4,
        status = $5,
        cufe = $6,
        pdf_url = $7,
        xml_url = $8,
        issued_at = $9,
        error = $10,
        type_document_id = $11,
        operation_type_id = $12,
        status_message = $13,
        customer_name = $14,
        customer_dni = $15,
        customer_email = $16,
        subtotal = $17,
        tax_total = $18,
        total = $19,
        currency_code = $20,
        matias_invoice_id = $21,
        matias_invoice_number = $22,
        updated_at = NOW()
      WHERE id = $1`,
      [
        meta.id,
        meta.orderCode,
        meta.prefix,
        meta.documentNumber,
        meta.status,
        meta.cufe ?? null,
        meta.pdfUrl ?? null,
        meta.xmlUrl ?? null,
        meta.issuedAt ?? null,
        meta.error ?? null,
        meta.typeDocumentId ?? null,
        meta.operationTypeId ?? null,
        meta.statusMessage ?? null,
        meta.customerName ?? null,
        meta.customerDni ?? null,
        meta.customerEmail ?? null,
        meta.subtotal ?? null,
        meta.taxTotal ?? null,
        meta.total ?? null,
        meta.currencyCode ?? null,
        meta.matiasInvoiceId ?? null,
        meta.matiasInvoiceNumber ?? null,
      ],
    );
  }

  async findById(id: string): Promise<InvoiceMetadata | null> {
    const { rows } = await this.pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return null;
    return this.rowToMetadata(rows[0] as Record<string, unknown>);
  }

  async findIssuedByOrderCode(orderCode: string): Promise<InvoiceMetadata | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${TABLE}
       WHERE order_code = $1 AND status = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderCode, InvoiceStatus.ISSUED],
    );
    if (!rows[0]) return null;
    return this.rowToMetadata(rows[0] as Record<string, unknown>);
  }

  async findBestByOrderCode(orderCode: string): Promise<InvoiceMetadata | null> {
    const issued = await this.findIssuedByOrderCode(orderCode);
    if (issued) return issued;
    const { rows } = await this.pool.query(
      `SELECT * FROM ${TABLE}
       WHERE order_code = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderCode],
    );
    if (!rows[0]) return null;
    return this.rowToMetadata(rows[0] as Record<string, unknown>);
  }

  async listInvoices(
    filter: {
      dateFrom?: Date;
      dateTo?: Date;
      customerDni?: string;
      status?: string;
      orderCode?: string;
    },
    pagination?: { take?: number; skip?: number },
  ): Promise<{ items: InvoiceListRow[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let i = 1;

    if (filter.dateFrom) {
      conditions.push(`created_at >= $${i++}`);
      params.push(filter.dateFrom);
    }
    if (filter.dateTo) {
      conditions.push(`created_at <= $${i++}`);
      params.push(filter.dateTo);
    }
    if (filter.customerDni) {
      conditions.push(`customer_dni = $${i++}`);
      params.push(filter.customerDni);
    }
    if (filter.status) {
      conditions.push(`status = $${i++}`);
      params.push(filter.status);
    }
    if (filter.orderCode) {
      conditions.push(`order_code = $${i++}`);
      params.push(filter.orderCode);
    }

    const where = conditions.join(' AND ');

    const countR = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM ${TABLE} WHERE ${where}`,
      params,
    );
    const total = countR.rows[0]?.c ?? 0;

    let sql = `
      SELECT * FROM ${TABLE}
      WHERE ${where}
      ORDER BY created_at DESC
    `;
    const listParams = [...params];
    if (pagination?.take != null) {
      sql += ` LIMIT $${listParams.length + 1}`;
      listParams.push(pagination.take);
    }
    if (pagination?.skip != null) {
      sql += ` OFFSET $${listParams.length + 1}`;
      listParams.push(pagination.skip);
    }

    const { rows } = await this.pool.query(sql, listParams);
    const items: InvoiceListRow[] = rows.map((row) => this.rowToListRow(row as Record<string, unknown>));
    return { items, total };
  }

  private rowToListRow(row: Record<string, unknown>): InvoiceListRow {
    const m = this.rowToMetadata(row);
    return {
      id: m.id,
      orderCode: m.orderCode,
      prefix: m.prefix,
      documentNumber: m.documentNumber,
      typeDocumentId: m.typeDocumentId ?? 0,
      operationTypeId: m.operationTypeId ?? 0,
      status: String(m.status),
      statusMessage: m.statusMessage ?? null,
      customerName: m.customerName || '',
      customerDni: m.customerDni || '',
      customerEmail: m.customerEmail ?? null,
      subtotal: m.subtotal || '0',
      taxTotal: m.taxTotal || '0',
      total: m.total || '0',
      currencyCode: m.currencyCode || 'COP',
      pdfUrl: m.pdfUrl ?? null,
      xmlUrl: m.xmlUrl ?? null,
      createdAt: m.createdAt,
    };
  }

  async getTotalsByDay(dateFrom: Date, dateTo: Date): Promise<
    Array<{ date: string; subtotal: string; taxTotal: string; total: string; count: number }>
  > {
    const raw = await this.pool.query(
      `SELECT
        (created_at::date)::text AS date,
        COALESCE(SUM(COALESCE((subtotal)::numeric, 0)), 0)::text AS subtotal,
        COALESCE(SUM(COALESCE((tax_total)::numeric, 0)), 0)::text AS "taxTotal",
        COALESCE(SUM(COALESCE((total)::numeric, 0)), 0)::text AS total,
        COUNT(*)::int AS count
       FROM ${TABLE}
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY (created_at::date)
       ORDER BY (created_at::date) ASC`,
      [dateFrom, dateTo],
    );
    return raw.rows as Array<{ date: string; subtotal: string; taxTotal: string; total: string; count: number }>;
  }

  async getTotalsByMonth(dateFrom: Date, dateTo: Date): Promise<
    Array<{
      year: number;
      month: number;
      subtotal: string;
      taxTotal: string;
      total: string;
      count: number;
    }>
  > {
    const raw = await this.pool.query(
      `SELECT
        EXTRACT(YEAR FROM created_at)::int AS year,
        EXTRACT(MONTH FROM created_at)::int AS month,
        COALESCE(SUM(COALESCE((subtotal)::numeric, 0)), 0)::text AS subtotal,
        COALESCE(SUM(COALESCE((tax_total)::numeric, 0)), 0)::text AS "taxTotal",
        COALESCE(SUM(COALESCE((total)::numeric, 0)), 0)::text AS total,
        COUNT(*)::int AS count
       FROM ${TABLE}
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)
       ORDER BY year ASC, month ASC`,
      [dateFrom, dateTo],
    );
    return raw.rows as Array<{
      year: number;
      month: number;
      subtotal: string;
      taxTotal: string;
      total: string;
      count: number;
    }>;
  }
}
