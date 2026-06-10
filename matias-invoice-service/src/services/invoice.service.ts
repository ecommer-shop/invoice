import { MatiasApiService } from './matias-api.service';
import { CreateInvoiceDto, InvoiceResponseDto, InvoiceStatusDto } from '@/models/invoice.dto';
import { transformToMatiasRequest } from '@/models/matias-request.dto';
import { InvoiceStatus } from '@/types/invoice.types';
import logger from '@/utils/logger';
import { getInvoiceDbPool } from '@/db/pool';
import { InvoiceRepository, type InvoiceMetadata } from '@/db/invoice-repository';

/** Fallback en memoria solo si no hay `INVOICE_SERVICE_DATABASE_URL`. */
const memoryStore = new Map<string, InvoiceMetadata>();

export class InvoiceService {
  private matiasApi: MatiasApiService;
  private repo: InvoiceRepository | null;

  constructor() {
    this.matiasApi = new MatiasApiService();
    const pool = getInvoiceDbPool();
    this.repo = pool ? new InvoiceRepository(pool) : null;
    if (!this.repo) {
      logger.warn(
        'INVOICE_SERVICE_DATABASE_URL no está definida: usando almacenamiento en memoria (solo desarrollo; en producción define una BD propia del microservicio).',
      );
    }
  }

  private async ready(): Promise<void> {
    if (this.repo) {
      await this.repo.ensureSchema();
    }
  }

  private async findIssuedByOrderCode(orderCode: string): Promise<InvoiceMetadata | null> {
    await this.ready();
    if (this.repo) {
      return this.repo.findIssuedByOrderCode(orderCode);
    }
    return (
      Array.from(memoryStore.values()).find(
        (inv) => inv.orderCode === orderCode && inv.status === InvoiceStatus.ISSUED,
      ) ?? null
    );
  }

  private async findBestByOrderCode(orderCode: string): Promise<InvoiceMetadata | null> {
    await this.ready();
    if (this.repo) {
      return this.repo.findBestByOrderCode(orderCode);
    }
    const issued = Array.from(memoryStore.values()).find(
      (inv) => inv.orderCode === orderCode && inv.status === InvoiceStatus.ISSUED,
    );
    if (issued) return issued;
    const all = Array.from(memoryStore.values()).filter((inv) => inv.orderCode === orderCode);
    if (all.length === 0) return null;
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  private async getById(invoiceId: string): Promise<InvoiceMetadata | null> {
    await this.ready();
    if (this.repo) {
      return this.repo.findById(invoiceId);
    }
    return memoryStore.get(invoiceId) ?? null;
  }

  private async persist(meta: InvoiceMetadata): Promise<void> {
    await this.ready();
    if (this.repo) {
      await this.repo.insert(meta);
    } else {
      memoryStore.set(meta.id, meta);
    }
  }

  private async persistUpdate(meta: InvoiceMetadata): Promise<void> {
    await this.ready();
    if (this.repo) {
      await this.repo.update(meta);
    } else {
      memoryStore.set(meta.id, meta);
    }
  }

  private toResponseDto(invoice: InvoiceMetadata, message?: string): InvoiceResponseDto {
    return {
      id: invoice.id,
      orderCode: invoice.orderCode,
      status: invoice.status,
      matiasInvoiceId:
        invoice.matiasInvoiceId ?? `${invoice.prefix}-${invoice.documentNumber}`,
      matiasInvoiceNumber:
        invoice.matiasInvoiceNumber ?? `${invoice.prefix}${invoice.documentNumber}`,
      cufe: invoice.cufe,
      pdfUrl: invoice.pdfUrl,
      xmlUrl: invoice.xmlUrl,
      issuedAt: invoice.issuedAt,
      error: invoice.error,
      ...(message !== undefined ? { message } : {}),
    };
  }

  /**
   * Crea una nueva factura
   */
  async createInvoice(dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
    try {
      logger.info('Creating invoice', { orderCode: dto.orderCode });

      const existingInvoice = await this.findIssuedByOrderCode(dto.orderCode);

      if (existingInvoice && existingInvoice.status === InvoiceStatus.ISSUED) {
        throw new Error(`Invoice already exists for order ${dto.orderCode}`);
      }

      const matiasRequest = transformToMatiasRequest(dto);

      const matiasResponse = await this.matiasApi.createInvoice(matiasRequest);

      if (!matiasResponse.success) {
        const errorMsg = matiasResponse.message || 'Invoice creation failed';
        throw new Error(errorMsg);
      }

      if (matiasResponse.response?.IsValid !== 'true') {
        const statusCode = matiasResponse.response?.StatusCode;
        const statusMessage = matiasResponse.response?.StatusMessage || 'Document validation failed';
        const errorDetails = matiasResponse.response?.ErrorMessage;

        logger.warn('Invoice created in Matias but rejected by DIAN', {
          xmlDocumentKey: matiasResponse.XmlDocumentKey,
          statusCode,
          statusMessage,
          errorDetails: errorDetails ? JSON.stringify(errorDetails) : undefined,
        });

        const errorMsg = `${statusMessage}${errorDetails ? ` - Details: ${JSON.stringify(errorDetails)}` : ''}`;
        throw new Error(errorMsg);
      }

      const invoiceId = `inv_${Date.now()}_${dto.orderCode}`;
      const metadata: InvoiceMetadata = {
        id: invoiceId,
        orderCode: dto.orderCode,
        prefix: dto.prefix,
        documentNumber: dto.documentNumber,
        status: InvoiceStatus.ISSUED,
        cufe: matiasResponse.XmlDocumentKey,
        pdfUrl: matiasResponse.pdf?.url,
        xmlUrl: matiasResponse.AttachedDocument?.url,
        issuedAt: new Date(),
        createdAt: new Date(),
        typeDocumentId: dto.typeDocumentId,
        operationTypeId: dto.operationTypeId,
        statusMessage: matiasResponse.response?.StatusMessage ?? null,
        customerName: dto.customer?.companyName ?? null,
        customerDni: dto.customer?.dni ?? null,
        customerEmail: dto.customer?.email ?? null,
        subtotal: dto.reportSubtotal ?? null,
        taxTotal: dto.reportTaxTotal ?? null,
        total: dto.reportTotal ?? null,
        currencyCode: dto.currencyCode ?? 'COP',
        matiasInvoiceId: `${dto.prefix}-${dto.documentNumber}`,
        matiasInvoiceNumber: `${dto.prefix}${dto.documentNumber}`,
      };

      await this.persist(metadata);

      logger.info('Invoice created successfully', {
        invoiceId,
        orderCode: dto.orderCode,
        cufe: matiasResponse.XmlDocumentKey,
        statusCode: matiasResponse.response?.StatusCode,
      });

      return this.toResponseDto(
        metadata,
        matiasResponse.response?.StatusMessage || 'Invoice created successfully',
      );
    } catch (error: any) {
      logger.error('Error creating invoice:', error);

      const invoiceId = `inv_${Date.now()}_${dto.orderCode}`;
      const errorMetadata: InvoiceMetadata = {
        id: invoiceId,
        orderCode: dto.orderCode,
        prefix: dto.prefix,
        documentNumber: dto.documentNumber,
        status: InvoiceStatus.REJECTED,
        error: error.message,
        createdAt: new Date(),
        typeDocumentId: dto.typeDocumentId,
        operationTypeId: dto.operationTypeId,
        customerName: dto.customer?.companyName ?? null,
        customerDni: dto.customer?.dni ?? null,
        customerEmail: dto.customer?.email ?? null,
        subtotal: dto.reportSubtotal ?? null,
        taxTotal: dto.reportTaxTotal ?? null,
        total: dto.reportTotal ?? null,
        currencyCode: dto.currencyCode ?? null,
      };
      await this.persist(errorMetadata);

      throw error;
    }
  }

  /**
   * Obtiene una factura por código de orden
   */
  async getInvoiceByOrderCode(orderCode: string): Promise<InvoiceResponseDto | null> {
    logger.info('Getting invoice by order code', { orderCode });

    const invoice = await this.findBestByOrderCode(orderCode);

    if (!invoice) {
      return null;
    }

    return this.toResponseDto(invoice);
  }

  /**
   * Obtiene el estado de una factura
   */
  async getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusDto> {
    logger.info('Getting invoice status', { invoiceId });

    const invoice = await this.getById(invoiceId);

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    if (invoice.prefix && invoice.documentNumber) {
      try {
        const matiasResponse = await this.matiasApi.getInvoice(invoice.prefix, invoice.documentNumber);

        if (matiasResponse.response?.IsValid === 'true') {
          invoice.status = InvoiceStatus.ISSUED;
        }
        invoice.cufe = matiasResponse.XmlDocumentKey || invoice.cufe;
        invoice.pdfUrl = matiasResponse.pdf?.url || invoice.pdfUrl;
        invoice.xmlUrl = matiasResponse.AttachedDocument?.url || invoice.xmlUrl;

        await this.persistUpdate(invoice);
      } catch (error: any) {
        logger.warn('Could not fetch updated status from Matias:', error);
      }
    }

    return {
      status: invoice.status,
      matiasInvoiceId: `${invoice.prefix}-${invoice.documentNumber}`,
      matiasInvoiceNumber: `${invoice.prefix}${invoice.documentNumber}`,
      cufe: invoice.cufe,
      pdfUrl: invoice.pdfUrl,
      xmlUrl: invoice.xmlUrl,
      error: invoice.error,
    };
  }

  /**
   * Reenvía una factura por email
   */
  async resendInvoice(invoiceId: string, email?: string): Promise<InvoiceResponseDto> {
    logger.info('Resending invoice', { invoiceId, email });

    const invoice = await this.getById(invoiceId);

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    if (!invoice.prefix || !invoice.documentNumber) {
      throw new Error(`Invoice does not have prefix/documentNumber: ${invoiceId}`);
    }

    try {
      if (email) {
        await this.matiasApi.resendInvoiceEmail(invoice.prefix, invoice.documentNumber, email);
      }

      logger.info('Invoice resent successfully', { invoiceId });

      return this.toResponseDto(invoice, 'Invoice resent successfully');
    } catch (error: any) {
      logger.error('Error resending invoice:', error);
      throw error;
    }
  }
}
