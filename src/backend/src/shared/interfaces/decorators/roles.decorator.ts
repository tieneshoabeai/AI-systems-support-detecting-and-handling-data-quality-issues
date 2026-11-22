import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('admin' | 'analyst')[]) : CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);
