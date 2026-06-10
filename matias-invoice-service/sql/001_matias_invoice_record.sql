
CREATE TABLE IF NOT EXISTS matias_invoice_record (
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

CREATE INDEX IF NOT EXISTS idx_matias_invoice_order_code
  ON matias_invoice_record (order_code);
