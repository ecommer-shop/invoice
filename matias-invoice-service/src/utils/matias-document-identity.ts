import type { MatiasInvoiceResponse } from '@/types/invoice.types';

export type MatiasDocumentIdentity = {
  prefix: string;
  documentNumber: string;
  displayNumber: string;
};

/**
 * Extrae prefijo y consecutivo desde la respuesta de Matias (StatusMessage / XmlFileName),
 * porque con auto-increment nosotros no enviamos document_number.
 */
export function resolveMatiasDocumentIdentity(
  response: MatiasInvoiceResponse,
  fallbackPrefix = 'AUTO',
): MatiasDocumentIdentity {
  const statusMessage = response.response?.StatusMessage ?? '';
  const fromStatus = statusMessage.match(
    /(?:Factura electr[oó]nica|documento)\s+([A-Za-z0-9]+?)(\d+)\b/i,
  );
  if (fromStatus) {
    return {
      prefix: fromStatus[1],
      documentNumber: fromStatus[2],
      displayNumber: `${fromStatus[1]}${fromStatus[2]}`,
    };
  }

  const xmlName = response.response?.XmlFileName?.trim() ?? '';
  if (xmlName) {
    const fromXml = xmlName.match(/^([A-Za-z]+)(\d+)$/);
    if (fromXml) {
      return {
        prefix: fromXml[1],
        documentNumber: fromXml[2],
        displayNumber: xmlName,
      };
    }
    return {
      prefix: fallbackPrefix,
      documentNumber: xmlName,
      displayNumber: xmlName,
    };
  }

  const key = response.XmlDocumentKey?.trim();
  if (key) {
    return {
      prefix: fallbackPrefix,
      documentNumber: key.slice(0, 32),
      displayNumber: key.slice(0, 32),
    };
  }

  return {
    prefix: fallbackPrefix,
    documentNumber: '0',
    displayNumber: `${fallbackPrefix}0`,
  };
}
