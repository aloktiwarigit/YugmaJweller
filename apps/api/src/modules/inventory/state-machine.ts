import { UnprocessableEntityException } from '@nestjs/common';

export type ProductStatus =
  | 'IN_STOCK'
  | 'SOLD'
  | 'RESERVED'
  | 'ON_APPROVAL'
  | 'WITH_KARIGAR';

export const TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  IN_STOCK:     ['RESERVED', 'ON_APPROVAL', 'WITH_KARIGAR', 'SOLD'],
  RESERVED:     ['IN_STOCK', 'ON_APPROVAL', 'SOLD'],
  ON_APPROVAL:  ['IN_STOCK', 'RESERVED', 'SOLD'],
  WITH_KARIGAR: ['IN_STOCK'],
  SOLD:         [],
};

export function isValidTransition(from: ProductStatus, to: ProductStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: ProductStatus, to: ProductStatus): void {
  if (!isValidTransition(from, to)) {
    throw new UnprocessableEntityException({
      code: 'inventory.invalid_status_transition',
      message: `Cannot transition from ${from} to ${to}`,
    });
  }
}
