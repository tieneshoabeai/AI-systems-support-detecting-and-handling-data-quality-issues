import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { CaslAbilityFactory, type CurrentUser } from './casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  type PolicyHandler,
  type PolicyContext,
} from './check-policies.decorator';
import {
  POLICY_RESOURCE_KEY,
  type PolicyResourceMetadata,
} from './policy-resource.decorator';
import { Action } from './actions.enum';
import type { AppSubjects, SubjectName } from './subjects.type';
import { buildSubject } from './subject.helper';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly moduleRef: ModuleRef
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(CHECK_POLICIES_KEY, context.getHandler()) ?? [];

    const request = context.switchToHttp().getRequest<{
      user?: CurrentUser;
      resource?: unknown;
      params?: Record<string, string>;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
    }>();

    const user = request.user;
    if (!user) {
      if (policyHandlers.length === 0) {
        return true;
      }
      throw new ForbiddenException('Không có quyền truy cập (Thiếu thông tin xác thực)');
    }

    if (policyHandlers.length === 0) {
      return true;
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const params = request.params || {};
    const body = request.body || {};
    const query = request.query || {};

    let isStaticallyAllowed = false;
    let checkedAtLeastOne = false;

    // 1. Tầng kiểm tra tĩnh (Static check trên SubjectName string)
    const spyAbility = new Proxy(ability, {
      get(target, prop, receiver) {
        if (prop === 'can') {
          return (action: Action, subjectInput: AppSubjects, field?: string) => {
            checkedAtLeastOne = true;
            const subjectStr =
              typeof subjectInput === 'string'
                ? subjectInput
                : (subjectInput && typeof subjectInput === 'object' && '__type' in subjectInput)
                ? (subjectInput as Record<string, unknown>).__type
                : (subjectInput && subjectInput.constructor && subjectInput.constructor.name) ||
                  subjectInput;

            if (typeof subjectStr === 'string' && target.can(action, subjectStr as SubjectName, field)) {
              isStaticallyAllowed = true;
              return true;
            }
            return false;
          };
        }
        if (prop === 'ability') return target;
        if (prop === 'user') return user;
        if (prop === 'request') return request;
        if (prop === 'params') return params;
        if (prop === 'body') return body;
        if (prop === 'query') return query;
        if (prop === 'resource') return undefined;

        const val = Reflect.get(target, prop, receiver);
        return typeof val === 'function' ? val.bind(target) : val;
      },
    }) as unknown as PolicyContext;

    for (const handler of policyHandlers) {
      await handler(spyAbility);
    }

    if (checkedAtLeastOne && !isStaticallyAllowed) {
      throw new ForbiddenException('Không có quyền thực hiện thao tác này (Static check failed)');
    }

    // 2. Tầng nạp tài nguyên động (Dynamic Resource Loader theo param :id)
    const resourceMeta =
      this.reflector.get<PolicyResourceMetadata>(POLICY_RESOURCE_KEY, context.getHandler()) ??
      this.reflector.get<PolicyResourceMetadata>(POLICY_RESOURCE_KEY, context.getClass());

    if (resourceMeta && request.params && request.params.id) {
      let loaderInstance: { load: (id: string, workspaceId?: string) => Promise<unknown> } | null = null;
      try {
        loaderInstance = this.moduleRef.get(resourceMeta.loader, { strict: false });
      } catch {
        loaderInstance = await this.moduleRef.resolve(resourceMeta.loader);
      }

      if (loaderInstance && typeof loaderInstance.load === 'function') {
        const resource = await loaderInstance.load(request.params.id, user.workspaceId);
        if (!resource) {
          throw new NotFoundException('Tài nguyên không tồn tại hoặc đã bị xóa');
        }
        request.resource = resource;
      }
    }

    // 3. Tầng kiểm tra động trên dữ liệu thực tế của Entity (Instance check)
    const resource = request.resource;
    const handlerCtx = new Proxy(ability, {
      get(target, prop, receiver) {
        if (prop === 'ability') return target;
        if (prop === 'user') return user;
        if (prop === 'request') return request;
        if (prop === 'params') return params;
        if (prop === 'body') return body;
        if (prop === 'query') return query;
        if (prop === 'resource') return resource;

        if (prop === 'can') {
          return (action: Action, subjectInput: AppSubjects, field?: string) => {
            let targetSubject = subjectInput;
            if (
              typeof subjectInput === 'string' &&
              resource &&
              resourceMeta &&
              resourceMeta.subject === subjectInput
            ) {
              targetSubject = buildSubject(
                subjectInput as SubjectName,
                resource as Record<string, unknown>
              );
            }
            return target.can(action, targetSubject, field);
          };
        }

        const val = Reflect.get(target, prop, receiver);
        return typeof val === 'function' ? val.bind(target) : val;
      },
    }) as unknown as PolicyContext;

    for (const handler of policyHandlers) {
      const allowed = await handler(handlerCtx);
      if (!allowed) {
        throw new ForbiddenException('Không có quyền thực hiện thao tác trên tài nguyên này (Policy check failed)');
      }
    }

    return true;
  }
}
