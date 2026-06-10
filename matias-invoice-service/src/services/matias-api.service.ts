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
  private async ensureAuthenticated(): Promise<void> {
    const now = new Date();
    const expiresAt = this.tokenExpiresAt || new Date(0);

    // Si no hay token o expira en menos de 5 minutos, renovar
    if (!this.accessToken || expiresAt.getTime() - now.getTime() < 300000) {
      await this.authenticate();
    }
  }

  /**
   * Crea una factura en Matias
   */
  async createInvoice(invoiceData: MatiasInvoiceRequest): Promise<MatiasInvoiceResponse> {
    try {
      await this.ensureAuthenticated();

      logger.info('Creating invoice in Matias API', {
        prefix: invoiceData.prefix,
        documentNumber: invoiceData.document_number,
      });

      // Log del payload completo para debugging
      logger.info('Matias invoice payload (full)', {
        payload: JSON.stringify(invoiceData, null, 2),
        payableAmount: invoiceData.legal_monetary_totals?.payable_amount,
        taxInclusiveAmount: invoiceData.legal_monetary_totals?.tax_inclusive_amount,
        lineExtensionAmount: invoiceData.legal_monetary_totals?.line_extension_amount,
      });

      const response = await this.httpClient.post<MatiasInvoiceResponse>(
        '/invoice',
        invoiceData
      );

      if (!response.success) {
        const errorMessage = response.message || 'Failed to create invoice';
        throw new Error(errorMessage);
      }

      logger.info('Invoice created successfully in Matias', {
        xmlDocumentKey: response.XmlDocumentKey,
        statusCode: response.response?.StatusCode,
        statusMessage: response.response?.StatusMessage,
      });

      return response;
    } catch (error: any) {
      logger.error('Error creating invoice in Matias:', toLoggableError(error));
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      throw new Error(`Failed to create invoice in Matias: ${errorMessage}`);
    }
  }

  /**
   * Obtiene los detalles de una factura por prefijo y número
   */
  async getInvoice(prefix: string, documentNumber: string): Promise<MatiasInvoiceResponse> {
    try {
      await this.ensureAuthenticated();

      logger.info('Getting invoice from Matias', { prefix, documentNumber });

      const invoiceId = `${prefix}-${documentNumber}`;
      const response = await this.httpClient.get<MatiasInvoiceResponse>(
        `/invoice/${invoiceId}`
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
   * Reenvía una factura por email
   */
  async resendInvoiceEmail(prefix: string, documentNumber: string, email: string): Promise<boolean> {
    try {
      await this.ensureAuthenticated();

      logger.info('Resending invoice email in Matias', { prefix, documentNumber, email });

      const invoiceId = `${prefix}-${documentNumber}`;
      const response = await this.httpClient.post<{ success: boolean; message?: string }>(
        `/invoice/${invoiceId}/send-email`,
        { email }
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to resend invoice email');
      }

      logger.info('Invoice email resent successfully', { prefix, documentNumber });
      return true;
    } catch (error: any) {
      logger.error('Error resending invoice email in Matias:', toLoggableError(error));
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
