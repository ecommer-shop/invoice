export enum InvoiceStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  ISSUED = 'issued',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

// Login Response (email/password authentication)
export interface MatiasAuthResponse {
  access_token: string;
  user: {
    id: number;
    type_id: number;
    first_name: string;
    last_name: string;
    email: string;
    avatar?: string;
    active: number;
    name: string;
    avatarUrl?: string;
    user_type?: {
      id: number;
      user_type_name: string;
      type: number;
      active: number;
    };
  };
  expires_at: string;
  message: string;
  success: boolean;
}

// Matias Invoice Request (estructura completa según documentación)
export interface MatiasInvoiceRequest {
  resolution_number: string;
  prefix: string;
  notes?: string;
  document_number: string;
  date?: string;
  time?: string;
  graphic_representation: number;
  send_email: number;
  operation_type_id: number;
  type_document_id: number;
  
  customer?: {
    country_id?: string;
    city_id?: string;
    identity_document_id?: string;
    type_organization_id?: number;
    tax_regime_id?: number;
    tax_level_id?: number;
    company_name: string;
    dni: string;
    mobile?: string;
    email?: string;
    address?: string;
    postal_code?: string;
    points?: number;
  };

  // Campos específicos para POS
  document_signature?: {
    cashier?: string;
    seller?: string;
  };

  point_of_sale?: {
    cashier_name: string;
    terminal_number: string;
    cashier_type: string;
    sales_code: string;
    address: string;
    sub_total: string;
  };

  software_manufacturer?: {
    owner_name: string;
    company_name: string;
    software_name: string;
  };

  // Campos para notas débito/crédito
  discrepancy_response?: {
    reference_id: string;
    response_id: string;
  };

  billing_reference?: {
    number: string;
    date: string;
    uuid: string;
    scheme_name?: string;
  };
  
  lines: Array<{
    invoiced_quantity: string;
    quantity_units_id: string;
    line_extension_amount: string;
    free_of_charge_indicator: boolean;
    description: string;
    code: string;
    type_item_identifications_id: string;
    reference_price_id: string;
    price_amount: string;
    base_quantity: string;
    allowance_charges?: Array<{
      amount: string;
      base_amount: string;
      charge_indicator: boolean;
      allowance_charge_reason: string;
    }>;
    tax_totals?: Array<{
      tax_id: string;
      tax_amount: number;
      taxable_amount: number;
      percent: number;
    }>;
  }>;
  
  legal_monetary_totals: {
    line_extension_amount: string;
    tax_exclusive_amount: string;
    tax_inclusive_amount: string;
    payable_amount: number;
    total_allowance?: number;
    total_charges?: number;
    pre_paid_amount?: number;
  };
  
  tax_totals?: Array<{
    tax_id: string;
    tax_amount: number;
    taxable_amount: number;
    percent: number;
  }>;
  
  payments: Array<{
    payment_method_id: number;
    means_payment_id: number;
    value_paid: string;
  }>;
}

// Matias Invoice Response
export interface MatiasInvoiceResponse {
  message: string;
  send_to_queue: number;
  XmlDocumentKey: string;
  response: {
    ErrorMessage: {
      string: string[];
    };
    IsValid: string;
    StatusCode: string;
    StatusDescription: string;
    StatusMessage: string;
    XmlBase64Bytes: string;
    XmlBytes: any;
    XmlDocumentKey: string;
    XmlFileName: string;
  };
  XmlBase64Bytes: string;
  AttachedDocument: {
    pathZip: string;
    path: string;
    url: string;
    data: string;
  };
  qr: {
    qrDian: string;
    url: string;
    path: string;
    data: string;
  };
  pdf: {
    path: string;
    url: string;
    data: string;
  };
  success: boolean;
}
