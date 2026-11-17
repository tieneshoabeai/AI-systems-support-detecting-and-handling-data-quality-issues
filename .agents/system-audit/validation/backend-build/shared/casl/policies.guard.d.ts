import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { CaslAbilityFactory } from './casl-ability.factory';
export declare class PoliciesGuard implements CanActivate {
    private readonly reflector;
    private readonly caslAbilityFactory;
    private readonly moduleRef;
    constructor(reflector: Reflector, caslAbilityFactory: CaslAbilityFactory, moduleRef: ModuleRef);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
