import 'reflect-metadata';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  dni!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  countryId?: string;

  @IsString()
  @IsOptional()
  cityId?: string;

  @IsString()
  @IsOptional()
  identityDocumentId?: string;

  @IsNumber()
  @IsOptional()
  typeOrganizationId?: number;

  @IsNumber()
  @IsOptional()
  taxRegimeId?: number;

  @IsNumber()
  @IsOptional()
  taxLevelId?: number;
}

// DTO simplificado para POS (type_document_id: 20)
export class PosCustomerDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  dni!: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

export class TaxTotalDto {
  @IsString()
  @IsNotEmpty()
  taxId!: string;

  @IsNumber()
  @Min(0)
  taxAmount!: number;

  @IsNumber()
  @Min(0)
  taxableAmount!: number;

  @IsNumber()
  @Min(0)
  percent!: number;
}

export class AllowanceChargeDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @Min(0)
  baseAmount!: number;

  @IsBoolean()
  chargeIndicator!: boolean; // false = descuento, true = cargo

  @IsString()
  @IsNotEmpty()
  allowanceChargeReason!: string; // Promocion, Volumen, Pronto pago, Bonificacion, Rebaja
}

export class InvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxPercent?: number;

  @IsString()
  @IsOptional()
  quantityUnitsId?: string;

  @IsString()
  @IsOptional()
  typeItemIdentificationsId?: string;

  @IsString()
  @IsOptional()
  referencePriceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceChargeDto)
  @IsOptional()
  allowanceCharges?: AllowanceChargeDto[];
}

export class PaymentDto {
  @IsNumber()
  @IsNotEmpty()
  paymentMethodId!: number;

  @IsNumber()
  @IsNotEmpty()
  meansPaymentId!: number;

  @IsNumber()
  @Min(0)
  valuePaid!: number;
}

export class DocumentSignatureDto {
  @IsString()
  @IsOptional()
  cashier?: string;

  @IsString()
  @IsOptional()
  seller?: string;
}

export class PointOfSaleDto {
  @IsString()
  @IsNotEmpty()
  cashierName!: string;

  @IsString()
  @IsNotEmpty()
  terminalNumber!: string;

  @IsString()
  @IsNotEmpty()
  cashierType!: string;

  @IsString()
  @IsNotEmpty()
  salesCode!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  subTotal!: string;
}

export class SoftwareManufacturerDto {
  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  softwareName!: string;
}

export class DiscrepancyResponseDto {
  @IsString()
  @IsNotEmpty()
  referenceId!: string;

  @IsString()
  @IsNotEmpty()
  responseId!: string;
}

export class BillingReferenceDto {
  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  uuid!: string;

  @IsString()
  @IsOptional()
  schemeName?: string;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  orderCode!: string;

  @IsString()
  @IsNotEmpty()
  resolutionNumber!: string;

  @IsString()
  @IsNotEmpty()
  prefix!: string;

  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsNumber()
  @IsOptional()
  graphicRepresentation?: number;

  @IsNumber()
  @IsOptional()
  sendEmail?: number;

  @IsNumber()
  @IsNotEmpty()
  operationTypeId!: number;

  @IsNumber()
  @IsNotEmpty()
  typeDocumentId!: number;

  @ValidateNested()
  @Type(() => CustomerDto)
  @IsOptional()
  customer?: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items!: InvoiceLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments!: PaymentDto[];

  // Campos específicos para POS
  @ValidateNested()
  @Type(() => DocumentSignatureDto)
  @IsOptional()
  documentSignature?: DocumentSignatureDto;

  @ValidateNested()
  @Type(() => PointOfSaleDto)
  @IsOptional()
  pointOfSale?: PointOfSaleDto;

  @ValidateNested()
  @Type(() => SoftwareManufacturerDto)
  @IsOptional()
  softwareManufacturer?: SoftwareManufacturerDto;

  // Campos para notas débito/crédito
  @ValidateNested()
  @Type(() => DiscrepancyResponseDto)
  @IsOptional()
  discrepancyResponse?: DiscrepancyResponseDto;

  @ValidateNested()
  @Type(() => BillingReferenceDto)
  @IsOptional()
  billingReference?: BillingReferenceDto;

  /** Snapshot de totales enviado por Vendure (solo persistencia / reportes en el micro). */
  @IsString()
  @IsOptional()
  reportSubtotal?: string;

  @IsString()
  @IsOptional()
  reportTaxTotal?: string;

  @IsString()
  @IsOptional()
  reportTotal?: string;

  @IsString()
  @IsOptional()
  currencyCode?: string;
}

export class InvoiceResponseDto {
  id!: string;
  orderCode!: string;
  status!: string;
  matiasInvoiceId?: string;
  matiasInvoiceNumber?: string;
  cufe?: string;
  qrCode?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  issuedAt?: Date;
  error?: string;
  message?: string;
}

export class InvoiceStatusDto {
  status!: string;
  matiasInvoiceId?: string;
  matiasInvoiceNumber?: string;
  cufe?: string;
  error?: string;
  pdfUrl?: string;
  xmlUrl?: string;
}
