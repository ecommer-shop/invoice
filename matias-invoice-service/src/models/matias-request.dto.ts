import { CreateInvoiceDto, InvoiceLineDto } from './invoice.dto';
import { MatiasInvoiceRequest } from '@/types/invoice.types';

/**
 * Transforma un CreateInvoiceDto (formato interno) a MatiasInvoiceRequest
 * (formato requerido por la API de Matias según documentación)
 */
export function transformToMatiasRequest(dto: CreateInvoiceDto): MatiasInvoiceRequest {
  // Calcular totales de líneas
  let totalLineExtensionAmount = 0;
  let totalTaxAmount = 0;

  const lines = dto.items.map((item) => {
    const quantity = item.quantity;
    const priceAmount = item.unitPrice;
    const baseAmount = quantity * priceAmount; // Valor original sin descuentos

    // Calcular descuentos si existen
    let totalDiscount = 0;
    const allowanceCharges: any[] = [];

    if (item.allowanceCharges && item.allowanceCharges.length > 0) {
      item.allowanceCharges.forEach((discount) => {
        // Validar que el descuento no exceda el base_amount (según guía de Matias)
        if (discount.amount > discount.baseAmount) {
          throw new Error(
            `El descuento (${discount.amount}) no puede exceder el monto base (${discount.baseAmount}) en el item "${item.description}"`
          );
        }

        if (!discount.chargeIndicator) {
          // Es un descuento (chargeIndicator = false)
          totalDiscount += discount.amount;
          allowanceCharges.push({
            amount: discount.amount.toFixed(2),
            base_amount: discount.baseAmount.toFixed(2),
            charge_indicator: false,
            allowance_charge_reason: discount.allowanceChargeReason || 'Promocion',
          });
        } else {
          // Es un cargo adicional (chargeIndicator = true)
          totalDiscount -= discount.amount; // Restar porque es un cargo
          allowanceCharges.push({
            amount: discount.amount.toFixed(2),
            base_amount: discount.baseAmount.toFixed(2),
            charge_indicator: true,
            allowance_charge_reason: discount.allowanceChargeReason || 'Cargo adicional',
          });
        }
      });
    }

    // Valor final después de descuentos/cargos
    const finalLineAmount = baseAmount - totalDiscount;
    totalLineExtensionAmount += finalLineAmount;

    // Calcular impuestos sobre el valor DESPUÉS del descuento
    // Según guía de Matias: tax_amount = taxable_amount × (percent / 100)
    // NO usar Math.round() para mantener precisión exacta
    // Usar ?? en lugar de || para permitir taxPercent = 0 (sin impuestos)
    const taxPercent = item.taxPercent ?? 19; // IVA por defecto 19% solo si no está definido
    const taxAmount = taxPercent > 0 ? (finalLineAmount * taxPercent) / 100 : 0;
    totalTaxAmount += taxAmount;

    const line: any = {
      invoiced_quantity: quantity.toString(),
      quantity_units_id: item.quantityUnitsId || '1093', // Unidad por defecto
      line_extension_amount: finalLineAmount.toFixed(2),
      free_of_charge_indicator: false,
      description: item.description,
      code: item.code || 'PROD001',
      type_item_identifications_id: item.typeItemIdentificationsId || '4',
      reference_price_id: item.referencePriceId || '1',
      price_amount: priceAmount.toString(),
      base_quantity: quantity.toString(),
    };

    // Agregar allowance_charges solo si hay descuentos/cargos
    if (allowanceCharges.length > 0) {
      line.allowance_charges = allowanceCharges;
    }

    // Agregar tax_totals solo si hay impuestos
    if (taxAmount > 0) {
      line.tax_totals = [
        {
          tax_id: '1', // IVA
          tax_amount: Number(taxAmount.toFixed(2)), // Mantener 2 decimales pero como número
          taxable_amount: Number(finalLineAmount.toFixed(2)),
          percent: taxPercent,
        },
      ];
    }

    return line;
  });

  // Si no hay impuestos, tax_exclusive_amount debe ser 0.00 (según ejemplo de Matias)
  // Pero tax_inclusive_amount y payable_amount deben ser el total después de descuentos
  const taxExclusiveAmount = totalTaxAmount > 0 ? totalLineExtensionAmount : 0;
  const taxInclusiveAmount = totalTaxAmount > 0 
    ? taxExclusiveAmount + totalTaxAmount 
    : totalLineExtensionAmount; // Sin impuestos, el total es el monto después de descuentos

  // Calcular totales legales
  const legalMonetaryTotals = {
    line_extension_amount: totalLineExtensionAmount.toFixed(2),
    tax_exclusive_amount: taxExclusiveAmount.toFixed(2),
    tax_inclusive_amount: taxInclusiveAmount.toFixed(2),
    payable_amount: taxInclusiveAmount,
  };

  // Totales de impuestos agrupados por porcentaje para evitar inconsistencias
  // entre líneas (ej. 20%) y total global (ej. 19%).
  const taxGroups = new Map<number, { taxAmount: number; taxableAmount: number }>();
  dto.items.forEach((item) => {
    const quantity = item.quantity;
    const priceAmount = item.unitPrice;
    const baseAmount = quantity * priceAmount;

    let totalDiscount = 0;
    if (item.allowanceCharges?.length) {
      item.allowanceCharges.forEach((discount) => {
        totalDiscount += discount.chargeIndicator ? -discount.amount : discount.amount;
      });
    }

    const finalLineAmount = baseAmount - totalDiscount;
    const taxPercent = item.taxPercent ?? 19;
    if (taxPercent <= 0) return;

    const group = taxGroups.get(taxPercent) ?? { taxAmount: 0, taxableAmount: 0 };
    group.taxableAmount += finalLineAmount;
    group.taxAmount += (finalLineAmount * taxPercent) / 100;
    taxGroups.set(taxPercent, group);
  });

  const taxTotals =
    totalTaxAmount > 0
      ? Array.from(taxGroups.entries()).map(([percent, group]) => ({
          tax_id: '1',
          tax_amount: Number(group.taxAmount.toFixed(2)),
          taxable_amount: Number(group.taxableAmount.toFixed(2)),
          percent,
        }))
      : [];

  // Transformar pagos
  const payments = dto.payments.map((payment) => ({
    payment_method_id: payment.paymentMethodId,
    means_payment_id: payment.meansPaymentId,
    value_paid: payment.valuePaid.toFixed(2),
  }));

  // Fecha y hora: DIAN requiere que la fecha de generación sea igual a la fecha de firma (hoy)
  // Si no se proporciona, usar fecha/hora actual
  const now = new Date();
  const invoiceDate = dto.date || now.toISOString().split('T')[0]; // YYYY-MM-DD
  const invoiceTime = dto.time || now.toTimeString().split(' ')[0].substring(0, 8); // HH:mm:ss

  const request: MatiasInvoiceRequest = {
    resolution_number: dto.resolutionNumber,
    prefix: dto.prefix,
    notes: dto.notes || '',
    document_number: dto.documentNumber,
    date: invoiceDate,
    time: invoiceTime,
    graphic_representation: dto.graphicRepresentation ?? 0,
    send_email: dto.sendEmail ?? 1,
    operation_type_id: dto.operationTypeId,
    type_document_id: dto.typeDocumentId,
    lines,
    legal_monetary_totals: legalMonetaryTotals,
    payments,
  };

  // Solo agregar tax_totals si hay impuestos (según ejemplo de Matias)
  if (taxTotals.length > 0) {
    request.tax_totals = taxTotals;
  }

  // Agregar customer según el tipo de documento
  if (dto.customer) {
    // DNI: Matias exige alfanumérico (sin guiones, puntos, etc.)
    const dniAlfanumerico = String(dto.customer.dni ?? '').replace(/[^A-Za-z0-9]/g, '') || dto.customer.dni;

    // Para POS (type_document_id: 20), customer puede ser simplificado
    if (dto.typeDocumentId === 20) {
      request.customer = {
        company_name: dto.customer.companyName,
        dni: dniAlfanumerico,
        email: dto.customer.email,
        points: 0, // Por defecto para POS
      };
    } else {
      // Para factura simple (type_document_id: 7), customer completo
      // Validar que tenga todos los campos requeridos (ya validado en middleware)
      request.customer = {
        country_id: dto.customer.countryId!,
        city_id: dto.customer.cityId!,
        identity_document_id: dto.customer.identityDocumentId!,
        type_organization_id: dto.customer.typeOrganizationId!,
        tax_regime_id: dto.customer.taxRegimeId!,
        tax_level_id: dto.customer.taxLevelId!,
        company_name: dto.customer.companyName,
        dni: dniAlfanumerico,
        mobile: dto.customer.mobile,
        email: dto.customer.email,
        address: dto.customer.address,
        postal_code: dto.customer.postalCode,
      };
    }
  }

  // Campos específicos para POS
  if (dto.typeDocumentId === 20) {
    if (dto.documentSignature) {
      request.document_signature = {
        cashier: dto.documentSignature.cashier,
        seller: dto.documentSignature.seller,
      };
    }

    if (dto.pointOfSale) {
      request.point_of_sale = {
        cashier_name: dto.pointOfSale.cashierName,
        terminal_number: dto.pointOfSale.terminalNumber,
        cashier_type: dto.pointOfSale.cashierType,
        sales_code: dto.pointOfSale.salesCode,
        address: dto.pointOfSale.address,
        sub_total: dto.pointOfSale.subTotal,
      };
    }

    if (dto.softwareManufacturer) {
      request.software_manufacturer = {
        owner_name: dto.softwareManufacturer.ownerName,
        company_name: dto.softwareManufacturer.companyName,
        software_name: dto.softwareManufacturer.softwareName,
      };
    }
  }

  // Campos para notas débito/crédito
  if (dto.typeDocumentId === 93 || dto.typeDocumentId === 94) {
    if (dto.discrepancyResponse) {
      request.discrepancy_response = {
        reference_id: dto.discrepancyResponse.referenceId,
        response_id: dto.discrepancyResponse.responseId,
      };
    }

    if (dto.billingReference) {
      request.billing_reference = {
        number: dto.billingReference.number,
        date: dto.billingReference.date,
        uuid: dto.billingReference.uuid,
        scheme_name: dto.billingReference.schemeName,
      };
    }
  }

  return request;
}
