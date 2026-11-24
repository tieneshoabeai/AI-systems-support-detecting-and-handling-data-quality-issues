import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { ForbiddenError, NotFoundError } from '../../domain/errors';
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
import { Action } from '../../domain/security/action';
import type { AppSubjects, SubjectName } from '../../domain/security/subjects';
import { buildSubject } from './subject.helper';
import {
  WORKSPACE_CONTEXT_PORT,
  type WorkspaceContextPort,
} from '../../application/ports/workspace-context.port';
import {
  PROJECT_CONTEXT_PORT,
  type ProjectContextPort,
} from '../../application/ports/project-context.port';

/**
 * PoliciesGuard — cổng kiểm tra phân quyền CASL (ABAC).
 *
 * Kiến trúc 2 tầng:
 *
 *   1. **Tầng tĩnh (static check)** — kiểm tra ở mức *loại subject*
 *      (`can(Update, 'Workspace')`). Trả `false` → chặn ngay.
 *      Mục đích: chặn sớm các endpoint mà user không có quyền với loại tài
 *      nguyên đó (ví dụ WS-MEMBER không được `Update` workspace).
 *
 *   2. **Tầng động (instance check)** — nạp tài nguyên thật từ DB qua
 *      `@PolicyResource(...)` rồi kiểm tra quyền trên chính instance đó với
 *      điều kiện thuộc tính (`workspace_id`, `owner_id`…).
 *      Mục đích: chống IDOR — user có quyền "đọc Workspace" nhưng chỉ được
 *      đọc workspace **của mình**, không đọc được workspace của người khác.
 *
 * Workspace context:
 *   Trước đây `CurrentUser.workspaceId` **chưa bao giờ được gán** ở bất kỳ đâu
 *   → nhánh phân quyền theo workspace trong `CaslAbilityFactory` là code chết
 *   và mọi endpoint Workspace/Project/Dataset trả 403 cho user thường (kể cả
 *   khi họ là OWNER). Nay guard resolve context từ `WORKSPACE_CONTEXT_PORT`
 *   (module `workspaces` hiện thực) cho mỗi request.
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Resolve adapter theo port token từ container (fail-safe → null nếu chưa bind).
   *
   * Dùng `ModuleRef` thay vì `@Inject` để `shared/casl` không phụ thuộc cứng vào
   * binding (module `workspaces`/`projects` tự bind adapter của mình), đồng thời
   * giữ đúng ranh giới tầng: `shared/` không import từ `modules/` (CA5).
   */
  private async resolvePort<T>(token: symbol): Promise<T | null> {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return null;
    }
  }

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
      throw new ForbiddenError('Không có quyền truy cập (Thiếu thông tin xác thực)');
    }

    if (policyHandlers.length === 0) {
      return true;
    }

    // ── Resolve workspace + project context của user (nếu chưa có) ─────────
    // Bắt buộc: `CaslAbilityFactory` cần biết user đang ở workspace/project
    // nào, vai trò gì để cấp quyền theo tầng (WS-OWNER / PROJ-MEMBER / ...).
    // Trước đây `CurrentUser.workspaceId` **chưa bao giờ được gán** → nhánh
    // phân quyền theo workspace là code chết và mọi endpoint Workspace/Project/
    // Dataset đều trả 403 cho user thường (kể cả khi họ là OWNER).
    if (!user.workspaceIds) {
      const wsCtx = await this.resolvePort<WorkspaceContextPort>(WORKSPACE_CONTEXT_PORT);
      if (wsCtx) {
        const ctx = await wsCtx.resolve(user.userId);
        user.workspaceIds = ctx.workspaceIds;
        user.workspaceRoles = ctx.roles;
        user.ownedWorkspaceIds = ctx.ownedWorkspaceIds;
      }
    }
    if (!user.projectRoles) {
      const prjCtx = await this.resolvePort<ProjectContextPort>(PROJECT_CONTEXT_PORT);
      if (prjCtx) {
        const ctx = await prjCtx.resolve(user.userId);
        user.projectRoles = ctx.roles;
      }
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const params = request.params || {};
    const body = request.body || {};
    const query = request.query || {};

    let isStaticallyAllowed = false;
    let checkedAtLeastOne = false;

    // 1. Tầng kiểm tra tĩnh (Static check trên SubjectName string)
    const spyAbility = new Proxy(ability, {
      get(target, prop, receiver): unknown {
        if (prop === 'can') {
          return (action: Action, subjectInput: AppSubjects, field?: string): boolean => {
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
        if (prop === 'resource') return request.resource;

        const val: unknown = Reflect.get(target, prop, receiver);
        return typeof val === 'function'
          ? (val as (...args: unknown[]) => unknown).bind(target)
          : val;
      },
    }) as unknown as PolicyContext;

    for (const handler of policyHandlers) {
      await handler(spyAbility);
    }

    if (checkedAtLeastOne && !isStaticallyAllowed) {
      throw new ForbiddenError('Không có quyền thực hiện thao tác này (Static check failed)');
    }

    // 2. Tầng nạp tài nguyên động (Dynamic Resource Loader theo route param)
    const resourceMeta =
      this.reflector.get<PolicyResourceMetadata>(POLICY_RESOURCE_KEY, context.getHandler()) ??
      this.reflector.get<PolicyResourceMetadata>(POLICY_RESOURCE_KEY, context.getClass());

    if (resourceMeta) {
      const paramName = resourceMeta.param ?? 'id';
      const resourceId = request.params?.[paramName];
      if (resourceId) {
        let loaderInstance: { load: (id: string, userId?: string) => Promise<unknown> } | null = null;
        try {
          loaderInstance = this.moduleRef.get(resourceMeta.loader, { strict: false });
        } catch {
          loaderInstance = await this.moduleRef.resolve(resourceMeta.loader);
        }

        if (loaderInstance && typeof loaderInstance.load === 'function') {
          const resource = await loaderInstance.load(resourceId, user.userId);
          if (!resource) {
            throw new NotFoundError('Tài nguyên không tồn tại hoặc đã bị xóa');
          }
          request.resource = resource;
        }
      }
    }

    // 3. Tầng kiểm tra động trên dữ liệu thực tế của Entity (Instance check)
    const resource = request.resource;
    const handlerCtx = new Proxy(ability, {
      get(target, prop, receiver): unknown {
        if (prop === 'ability') return target;
        if (prop === 'user') return user;
        if (prop === 'request') return request;
        if (prop === 'params') return params;
        if (prop === 'body') return body;
        if (prop === 'query') return query;
        if (prop === 'resource') return resource;

        if (prop === 'can') {
          return (action: Action, subjectInput: AppSubjects, field?: string): boolean => {
            let targetSubject = subjectInput;
            // Subject dạng object `{ __type: 'Workspace' }` → chuẩn hoá về tên
            // subject để tầng động xử lý **giống hệt** tầng tĩnh (vốn đã
            // đọc `__type`). Nếu không, một policy viết bằng object sẽ qua
            // static check (vì `__type` khớp) nhưng lại fail ở dynamic check
            // (vì CASL không hiểu object thô) ⇒ 403 oan dù policy hợp lệ.
            const subjectName =
              typeof subjectInput === 'string'
                ? subjectInput
                : subjectInput && typeof subjectInput === 'object' && '__type' in subjectInput
                  ? ((subjectInput as Record<string, unknown>).__type as string)
                  : null;

            if (
              subjectName &&
              resource &&
              resourceMeta &&
              resourceMeta.subject === subjectName
            ) {
              targetSubject = buildSubject(
                subjectName as SubjectName,
                resource as Record<string, unknown>,
              );
            } else if (subjectName) {
              // Không có resource thuộc subject này → dùng tên subject dạng
              // chuỗi (giống tầng tĩnh) để CASL hiểu đúng rule.
              targetSubject = subjectName as SubjectName;
            }
            return target.can(action, targetSubject, field);
          };
        }

        const val: unknown = Reflect.get(target, prop, receiver);
        return typeof val === 'function'
          ? (val as (...args: unknown[]) => unknown).bind(target)
          : val;
      },
    }) as unknown as PolicyContext;

    for (const handler of policyHandlers) {
      const allowed = await handler(handlerCtx);
      if (!allowed) {
        throw new ForbiddenError('Không có quyền thực hiện thao tác trên tài nguyên này (Policy check failed)');
      }
    }

    return true;
  }
}
