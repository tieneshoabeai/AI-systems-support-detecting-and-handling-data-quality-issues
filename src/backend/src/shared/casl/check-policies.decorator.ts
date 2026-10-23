import { SetMetadata } from '@nestjs/common';
import type { AppAbility, CurrentUser } from './casl-ability.factory';

export const CHECK_POLICIES_KEY = 'check_policy';

export interface PolicyContextFields {
  ability: AppAbility;
  user: CurrentUser;
  request: unknown;
  params: Record<string, string>;
  body: unknown;
  query: unknown;
  resource?: unknown;
}

export type PolicyContext = AppAbility & PolicyContextFields;

export type PolicyHandler = (ctx: PolicyContext) => boolean | Promise<boolean>;

export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
