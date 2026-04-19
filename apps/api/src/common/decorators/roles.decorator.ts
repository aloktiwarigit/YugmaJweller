import { SetMetadata } from '@nestjs/common';
import type { ShopUserRole } from '@goldsmith/tenant-context';
import { ROLES_KEY } from '../guards/roles.guard';

export const Roles = (...roles: ShopUserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
