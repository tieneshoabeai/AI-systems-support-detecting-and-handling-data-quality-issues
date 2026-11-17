import type { AppAbility, CurrentUser } from './casl-ability.factory';
export declare const CHECK_POLICIES_KEY = "check_policy";
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
export declare const CheckPolicies: (...handlers: PolicyHandler[]) => import("@nestjs/common").CustomDecorator<string>;
