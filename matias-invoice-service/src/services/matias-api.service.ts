import { HttpClient } from '@/utils/http-client';
import { config } from '@/config/environment';
import logger from '@/utils/logger';
import {
  MatiasAuthResponse,
  MatiasInvoiceRequest,
  MatiasInvoiceResponse,
} from '@/types/invoice.types';
import axios from 'axios';

/** Extrae solo campos serializables de un error (evita circular refs en Axios) */
function toLoggableError(err: unknown): Record<string, unknown> {
  if (err != null && typeof err === 'object' && 'message' in err) {
    const e = err as { message?: string; response?: { status?: number; statusText?: string; data?: unknown }; code?: string; config?: { url?: string } };
    return {
      message: e.message,
      status: e.response?.status,
      statusText: e.response?.statusText,
      responseData: e.response?.data,
      code: e.code,
      url: e.config?.url,
    };
  }
  return { value: String(err) };
}

export class MatiasApiService {
  private httpClient: HttpClient;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.httpClient = new HttpClient(config.matias.apiUrl);
  }

  /**
   * Autentica con la API de Matias usando email y password
   */
  async authenticate(): Promise<string> {
    try {
      logger.info('Authenticating with Matias API (email/password)...');

      // Login usa application/json
      const loginData = {
        email: config.matias.email,
        password: config.matias.password,
        remember_me: 0,
      };

      // Normalizar URL base (remover barra final si existe)
      const baseUrl = config.matias.apiUrl.replace(/\/+$/, '');
      const loginUrl = `${baseUrl}/auth/login`;

      logger.info('Sending login request to Matias', {
        url: loginUrl,
        email: config.matias.email,
      });

      const response = await axios.post<MatiasAuthResponse>(
        loginUrl,
        loginData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      // Verificar si la respuesta es HTML (error común cuando la URL está mal)
      const contentType = String(response.headers['content-type'] ?? '');
      if (contentType.includes('text/html')) {
        const data = response.data as unknown;
        logger.error('Received HTML instead of JSON - URL might be incorrect', {
          url: loginUrl,
          contentType,
          responsePreview: typeof data === 'string' ? data.substring(0, 200) : 'Non-string response',
        });
        throw new Error('Received HTML response instead of JSON. Check MATIAS_API_URL configuration.');
      }

      logger.info('Matias login response received', {
        status: response.status,
        contentType,
        hasAccessToken: !!response.data?.access_token,
        success: response.data?.success,
        message: response.data?.message,
        responseData: JSON.stringify(response.data),
      });

      if (!response.data?.access_token) {
        logger.error('No access token in response', {
          responseData: JSON.stringify(response.data),
          contentType,
        });
        throw new Error('No access token received');
      }

      if (!response.data.success) {
        throw new Error(response.data.message || 'Authentication failed');
      }

      this.accessToken = response.data.access_token;
      if (!this.accessToken) {
        throw new Error('Matias authentication response did not include an access token');
      }
      
      // expires_at viene en formato string "YYYY-MM-DD HH:mm:ss"
      // El token tiene validez de 1 año según la documentación
      if (response.data.expires_at) {
        this.tokenExpiresAt = new Date(response.data.expires_at);
      } else {
        // Si no viene expires_at, asumimos 1 año desde ahora
        this.tokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }

      // Configurar token en el cliente HTTP
      this.httpClient.setAuthToken(this.accessToken);

      logger.info('Successfully authenticated with Matias API', {
        expiresAt: this.tokenExpiresAt.toISOString(),
        user: response.data.user?.email,
      });

      return this.accessToken;
    } catch (error: any) {
      // Normalizar URL para el log
      const baseUrl = config.matias.apiUrl.replace(/\/+$/, '');
      const loginUrl = `${baseUrl}/auth/login`;

      // Detectar si la respuesta es HTML
      const responseData = error.response?.data;
      const isHtmlResponse = typeof responseData === 'string' && responseData.trim().startsWith('<!DOCTYPE');
      
      logger.error('Matias authentication error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        contentType: error.response?.headers?.['content-type'],
        isHtmlResponse,
        responseData: isHtmlResponse 
          ? `HTML response (${responseData.length} chars): ${responseData.substring(0, 200)}...`
          : (responseData ? JSON.stringify(responseData) : 'No response data'),
        requestUrl: loginUrl,
        requestData: { email: config.matias.email, password: '***hidden***' },
        code: error.code,
      });
      
      if (isHtmlResponse) {
        throw new Error('Received HTML response instead of JSON. Verify MATIAS_API_URL is correct (should be API endpoint, not website).');
      }
      
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      throw new Error(`Failed to authenticate with Matias: ${errorMessage}`);
    }
  }

  /**
   * Verifica si el token es válido y lo renueva si es necesario
   */
  private async ensureAuthenticated(tokenOverride?: string | null): Promise<void> {
    if (tokenOverride?.trim()) {
      logger.info('Using Matias bearer token from request header', {
        tokenLength: tokenOverride.trim().length,
        hasBearerPrefix: /^Bearer\s+/i.test(tokenOverride.trim()),
      });
      this.httpClient.setAuthToken(tokenOverride.trim());
      return;
    }

    const now = new Date();
    const expiresAt = this.tokenExpiresAt || new Date(0);

    // Si no hay token o expira en menos de 5 minutos, renovar
    if (!this.accessToken || expiresAt.getTime() - now.getTime() < 300000) {
      await this.authenticate();
    } else {
      this.httpClient.setAuthToken(this.accessToken);
    }
  }

  /**
   * Crea una factura en Matias.
   * Con client UUID (Casa de Software): POST /auto-increment/invoices?client_uuid=
   * Sin UUID: POST /invoice (legacy: prefix + resolution + document_number).
   * OpenAPI: https://api-v2.matias-api.com/api/docs
   */
  /**
   * Crea una factura en Matias.
   * Con client UUID (Casa de Software): POST /auto-increment/invoices?client_uuid=
   * Sin UUID: no soportado (exige Company ID).
   * Si Matias dice que FEV{n} ya está validado (consecutivo desfasado tras un fallo de PDF),
   * reintenta con document_number n+1…n+5 por /invoice?client_uuid=.
   */
  async createInvoice(
    invoiceData: MatiasInvoiceRequest,
    tokenOverride?: string | null,
    clientUuidOverride?: string | null,
  ): Promise<MatiasInvoiceResponse> {
    await this.ensureAuthenticated(tokenOverride);

    const clientUuid =
      clientUuidOverride?.trim() ||
      invoiceData.companyId?.trim() ||
      invoiceData.company_id?.trim() ||
      null;

    if (!clientUuid) {
      throw new Error(
        'Falta matiasCompanyId (Company ID / UUID). Configúralo en Ventas → Matias por tienda. ' +
          'Sin Company ID no se puede usar auto-increment y Matias exige document_number manual.',
      );
    }

    // Nunca enviar document_number vacío: Matias lo rechaza con "should not be empty".
    if (!invoiceData.document_number?.trim()) {
      delete invoiceData.document_number;
    }

    delete invoiceData.company_id;
    invoiceData.companyId = clientUuid;
    // Auto-increment: omitir document_number.
    delete invoiceData.document_number;

    logger.info('Creating invoice in Matias API', {
      clientUuid,
      prefix: invoiceData.prefix ?? null,
      documentNumber: null,
      mode: 'auto-increment',
    });

    logger.info('Matias invoice payload (full)', {
      payload: JSON.stringify(invoiceData, null, 2),
      payableAmount: invoiceData.legal_monetary_totals?.payable_amount,
      taxInclusiveAmount: invoiceData.legal_monetary_totals?.tax_inclusive_amount,
      lineExtensionAmount: invoiceData.legal_monetary_totals?.line_extension_amount,
    });

    const autoPath = `/auto-increment/invoices?client_uuid=${encodeURIComponent(clientUuid)}`;

    try {
      return await this.postMatiasInvoice(autoPath, invoiceData);
    } catch (error: any) {
      const errorMessage = this.formatMatiasCreateError(error);
      const dup = /con n[uú]mero\s+([A-Za-z]*)(\d+)/i.exec(errorMessage);

      if (!dup || !/ya se encuentra validado/i.test(errorMessage)) {
        logger.error('Error creating invoice in Matias:', toLoggableError(error));
        throw new Error(this.enrichMatiasCreateError(errorMessage, invoiceData, clientUuid));
      }

      const usedNum = parseInt(dup[2], 10);
      if (!Number.isFinite(usedNum) || usedNum < 0) {
        logger.error('Error creating invoice in Matias:', toLoggableError(error));
        throw new Error(`Failed to create invoice in Matias: ${errorMessage}`);
      }

      logger.warn(
        `Matias reportó documento duplicado ${dup[1]}${usedNum}; reintentando con siguientes consecutivos`,
        { clientUuid, prefix: invoiceData.prefix, usedNum },
      );

      let lastErrorMessage = errorMessage;
      for (let n = usedNum + 1; n <= usedNum + 5; n++) {
        const retryPayload: MatiasInvoiceRequest = {
          ...invoiceData,
          companyId: clientUuid,
          document_number: String(n),
        };
        delete retryPayload.company_id;
        const manualPath = `/invoice?client_uuid=${encodeURIComponent(clientUuid)}`;
        try {
          logger.info('Retrying Matias invoice with explicit document_number', {
            documentNumber: n,
            path: manualPath,
          });
          return await this.postMatiasInvoice(manualPath, retryPayload);
        } catch (retryError: any) {
          lastErrorMessage = this.formatMatiasCreateError(retryError);
          if (!/ya se encuentra validado/i.test(lastErrorMessage)) {
            logger.error('Error creating invoice in Matias (retry):', toLoggableError(retryError));
            throw new Error(`Failed to create invoice in Matias: ${lastErrorMessage}`);
          }
          logger.warn(`Consecutivo ${invoiceData.prefix ?? ''}${n} también duplicado; probando siguiente`);
        }
      }

      throw new Error(
        `Failed to create invoice in Matias: ${lastErrorMessage}. ` +
          `El consecutivo de Matias está desfasado (p. ej. ${dup[1]}${usedNum} ya validado). ` +
          'En el panel Matias, avanza el siguiente número de la resolución o contacta soporte.',
      );
    }
  }

  private async postMatiasInvoice(
    path: string,
    invoiceData: MatiasInvoiceRequest,
  ): Promise<MatiasInvoiceResponse> {
    try {
      const response = await this.httpClient.post<MatiasInvoiceResponse>(path, invoiceData);

      const rawResponse = response as unknown;
      if (typeof rawResponse === 'string') {
        const preview = rawResponse.replace(/\s+/g, ' ').trim().slice(0, 500);
        logger.error('Matias returned HTML/text instead of JSON', { preview });
        throw new Error(
          'Matias devolvió HTML/texto en lugar de JSON. Revisa MATIAS_API_URL y la ruta de emisión.',
        );
      }

      if (!response.success) {
        const errorDetails = response.response?.ErrorMessage;
        const detailList = Array.isArray((errorDetails as { string?: string[] })?.string)
          ? (errorDetails as { string: string[] }).string.join(' · ')
          : null;
        const statusMessage = response.response?.StatusMessage;
        const statusDescription = response.response?.StatusDescription;
        const statusCode = response.response?.StatusCode;
        const errorMessage =
          statusMessage ||
          statusDescription ||
          detailList ||
          (errorDetails ? JSON.stringify(errorDetails) : null) ||
          response.message ||
          'Failed to create invoice';
        logger.error('Matias rejected invoice creation', {
          message: response.message,
          statusCode,
          statusDescription,
          statusMessage,
          errorDetails,
          xmlDocumentKey: response.XmlDocumentKey,
          rawResponse: JSON.stringify(response).slice(0, 2000),
        });
        const codePart = statusCode ? ` (código ${statusCode})` : '';
        const err = new Error(
          detailList && errorMessage !== detailList
            ? `${errorMessage}${codePart} — ${detailList}`
            : `${errorMessage}${codePart}`,
        );
        (err as Error & { matiasResponse?: MatiasInvoiceResponse }).matiasResponse = response;
        throw err;
      }

      logger.info('Invoice created successfully in Matias', {
        xmlDocumentKey: response.XmlDocumentKey,
        statusCode: response.response?.StatusCode,
        statusMessage: response.response?.StatusMessage,
      });

      return response;
    } catch (error: any) {
      if (error?.matiasResponse || (error?.message && !error?.response)) {
        throw error;
      }
      // Axios / HTTP errors: rethrow with response attached for formatMatiasCreateError
      throw error;
    }
  }

  private formatMatiasCreateError(error: any): string {
    const data = error?.response?.data;
    const messageFromArray = Array.isArray(data?.message)
      ? data.message.filter((m: unknown) => typeof m === 'string').join(' · ')
      : null;
    const detailList = Array.isArray(data?.response?.ErrorMessage?.string)
      ? data.response.ErrorMessage.string.join(' · ')
      : Array.isArray(data?.details)
        ? data.details
            .map((d: any) => {
              if (typeof d === 'string') return d;
              if (d?.constraints) {
                const vals = Object.values(d.constraints).filter(Boolean);
                return d.property ? `${d.property}: ${vals.join('; ')}` : vals.join('; ');
              }
              return d?.message || null;
            })
            .filter(Boolean)
            .join(' · ')
        : null;
    return (
      messageFromArray ||
      (typeof data?.message === 'string' ? data.message : null) ||
      data?.response?.StatusMessage ||
      detailList ||
      error?.message ||
      'Unknown error'
    );
  }

  private enrichMatiasCreateError(
    errorMessage: string,
    invoiceData: MatiasInvoiceRequest,
    clientUuid: string,
  ): string {
    const prefix = invoiceData.prefix?.trim() || '—';
    const resolution = invoiceData.resolution_number?.trim() || '—';
    let msg = `Failed to create invoice in Matias: ${errorMessage}`;

    if (/resoluci[oó]n de facturaci[oó]n activa/i.test(errorMessage)) {
      msg +=
        ` (prefijo=${prefix}, resolución=${resolution}, company=${clientUuid}).` +
        ' Verifica en Matias que esa resolución esté vigente hoy para ese Company ID.';
    }

    return msg;
  }

  private clientUuidQuery(clientUuid?: string | null): string {
    return clientUuid?.trim()
      ? `?client_uuid=${encodeURIComponent(clientUuid.trim())}`
      : '';
  }

  /**
   * Consulta estado DIAN por trackId (CUFE / XmlDocumentKey).
   * OpenAPI: POST /status/document/{trackId}?client_uuid=
   */
  async getDocumentStatusByTrackId(
    trackId: string,
    tokenOverride?: string | null,
    clientUuid?: string | null,
  ): Promise<MatiasInvoiceResponse> {
    try {
      await this.ensureAuthenticated(tokenOverride);
      const key = trackId.trim();
      logger.info('Getting Matias document status by trackId', {
        trackId: key.slice(0, 16),
        clientUuid: clientUuid ?? null,
      });

      const response = await this.httpClient.post<MatiasInvoiceResponse>(
        `/status/document/${encodeURIComponent(key)}${this.clientUuidQuery(clientUuid)}`,
      );

      if (response && typeof response === 'object' && 'success' in response && (response as any).success === false) {
        throw new Error((response as any).message || 'Failed to get document status');
      }

      return response;
    } catch (error: any) {
      logger.error('Error getting Matias document status:', toLoggableError(error));
      throw new Error(`Failed to get document status: ${error?.message ?? 'Unknown'}`);
    }
  }

  /**
   * Fallback legacy: consulta por prefijo y número.
   */
  async getInvoiceByPrefixNumber(
    prefix: string,
    documentNumber: string,
    tokenOverride?: string | null,
    clientUuid?: string | null,
  ): Promise<MatiasInvoiceResponse> {
    try {
      await this.ensureAuthenticated(tokenOverride);

      logger.info('Getting invoice from Matias by prefix-number', {
        prefix,
        documentNumber,
        clientUuid: clientUuid ?? null,
      });

      const invoiceId = `${prefix}-${documentNumber}`;
      const response = await this.httpClient.get<MatiasInvoiceResponse>(
        `/invoice/${invoiceId}${this.clientUuidQuery(clientUuid)}`,
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to get invoice');
      }

      return response;
    } catch (error: any) {
      logger.error('Error getting invoice from Matias:', toLoggableError(error));
      throw new Error(`Failed to get invoice: ${error?.message ?? 'Unknown'}`);
    }
  }

  /**
   * Reenvía correo por trackId/CUFE.
   * OpenAPI: POST /documents/sendmail/{trackId}?client_uuid=
   */
  async resendInvoiceEmailByCufe(
    cufe: string,
    email: string,
    tokenOverride?: string | null,
    clientUuid?: string | null,
  ): Promise<boolean> {
    try {
      await this.ensureAuthenticated(tokenOverride);
      const key = cufe.trim();

      logger.info('Resending invoice email in Matias by trackId/CUFE', {
        trackId: key.slice(0, 16),
        email,
        clientUuid: clientUuid ?? null,
      });

      const response = await this.httpClient.post<{ success: boolean; message?: string }>(
        `/documents/sendmail/${encodeURIComponent(key)}${this.clientUuidQuery(clientUuid)}`,
        { email },
      );

      if (response && typeof response === 'object' && 'success' in response && response.success === false) {
        throw new Error(response.message || 'Failed to resend invoice email');
      }

      logger.info('Invoice email resent successfully by trackId/CUFE', { trackId: key.slice(0, 16) });
      return true;
    } catch (error: any) {
      logger.error('Error resending invoice email by CUFE:', toLoggableError(error));
      throw new Error(`Failed to resend invoice email: ${error?.message ?? 'Unknown'}`);
    }
  }

  /**
   * Obtiene el token actual (para debugging)
   */
  getCurrentToken(): string | null {
    return this.accessToken;
  }
}
