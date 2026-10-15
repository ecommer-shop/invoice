import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { NextRequest } from 'next/server';

/**
 * Valida un DTO usando class-validator
 */
export async function validateDto<T extends object>(
  DtoClass: new () => T,
  data: any
): Promise<{ valid: boolean; dto?: T; errors?: ValidationError[] }> {
  const dto = plainToInstance(DtoClass, data);
  const errors = await validate(dto);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, dto };
}

/**
 * Extrae el body de una request de Next.js
 */
export async function getRequestBody(request: NextRequest): Promise<any> {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

