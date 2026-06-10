import { CreateInvoiceDto } from '@/models/invoice.dto';
import { NextResponse } from 'next/server';
import { createValidationErrorResponse } from './error.middleware';

/**
 * Valida campos condicionales según el tipo de documento
 */
export function validateInvoiceByType(dto: CreateInvoiceDto): { valid: boolean; errors?: any[] } {
  const errors: any[] = [];

  // Validación para POS (type_document_id: 20)
  if (dto.typeDocumentId === 20) {
    if (!dto.pointOfSale) {
      errors.push({
        property: 'pointOfSale',
        constraints: { isRequired: 'pointOfSale is required for POS documents (type_document_id: 20)' },
      });
    }
    if (!dto.softwareManufacturer) {
      errors.push({
        property: 'softwareManufacturer',
        constraints: { isRequired: 'softwareManufacturer is required for POS documents (type_document_id: 20)' },
      });
    }
  }

  // Validación para Nota Débito (type_document_id: 93)
  if (dto.typeDocumentId === 93) {
    if (!dto.discrepancyResponse) {
      errors.push({
        property: 'discrepancyResponse',
        constraints: { isRequired: 'discrepancyResponse is required for Debit Notes (type_document_id: 93)' },
      });
    }
    if (!dto.billingReference) {
      errors.push({
        property: 'billingReference',
        constraints: { isRequired: 'billingReference is required for Debit Notes (type_document_id: 93)' },
      });
    }
  }

  // Validación para Nota Crédito (type_document_id: 94)
  if (dto.typeDocumentId === 94) {
    if (!dto.discrepancyResponse) {
      errors.push({
        property: 'discrepancyResponse',
        constraints: { isRequired: 'discrepancyResponse is required for Credit Notes (type_document_id: 94)' },
      });
    }
    if (!dto.billingReference) {
      errors.push({
        property: 'billingReference',
        constraints: { isRequired: 'billingReference is required for Credit Notes (type_document_id: 94)' },
      });
    }
  }

  // Validación para factura simple (type_document_id: 7) - customer requerido con todos los campos
  if (dto.typeDocumentId === 7) {
    if (!dto.customer) {
      errors.push({
        property: 'customer',
        constraints: { isRequired: 'customer is required for simple invoices (type_document_id: 7)' },
      });
    } else {
      // Validar que tenga todos los campos requeridos para factura simple
      if (!dto.customer.countryId || !dto.customer.cityId || !dto.customer.identityDocumentId ||
          dto.customer.typeOrganizationId === undefined || dto.customer.taxRegimeId === undefined || 
          dto.customer.taxLevelId === undefined) {
        errors.push({
          property: 'customer',
          constraints: { 
            isRequired: 'customer must have countryId, cityId, identityDocumentId, typeOrganizationId, taxRegimeId, and taxLevelId for simple invoices (type_document_id: 7)' 
          },
        });
      }
    }
  }

  // Para POS, customer es opcional pero si se envía debe tener al menos company_name y dni
  if (dto.typeDocumentId === 20 && dto.customer) {
    if (!dto.customer.companyName || !dto.customer.dni) {
      errors.push({
        property: 'customer',
        constraints: { 
          isRequired: 'customer.companyName and customer.dni are required if customer is provided for POS' 
        },
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
