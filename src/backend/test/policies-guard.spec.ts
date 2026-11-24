/**
 * B2.7 — Test unit cho `PoliciesGuard` (2 tầng: static check + dynamic instance check).
 *
 * Đây là **trái tim** của phân quyền CASL/ABAC. Trước đây file này có 0%
 * coverage ⇒ mọi quyết định "cho phép / chặn" trong hệ thống đều **không được
 * kiểm chứng tự động**. Bộ test này chứng minh:
 *
 *   1. Tầng tĩnh: `can(Action, 'Subject')` phải trả `true` nếu user có quyền
 *      ở mức *loại* — nếu không → 403 (chặn sớm).
 *   2. Tầng động: resource thật được nạp qua `@PolicyResource` → instance
 *      check chống IDOR (user có quyền "đọc Workspace" nhưng không đọc được
 *      workspace của người khác).
 *   3. Fail-safe: thiếu context adapter ⇒ vẫn chạy được (không ném 500).
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { PoliciesGuard } from '../src/shared/interfaces/casl/policies.guard';
import { CaslAbilityFactory, type CurrentUser } from '../src/shared/interfaces/casl/casl-ability.factory';
import { CHECK_POLICIES_KEY, type PolicyHandler } from '../src/shared/interfaces/casl/check-policies.decorator';
import { POLICY_RESOURCE_KEY, type PolicyResourceMetadata } from '../src/shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../src/shared/domain/security/action';
import { ForbiddenError, NotFoundError } from '../src/shared/domain/errors';
import { WORKSPACE_CONTEXT_PORT } from '../src/shared/application/ports/workspace-context.port';
import { PROJECT_CONTEXT_PORT } from '../src/shared/application/ports/project-context.port';

describe('B2.7 — PoliciesGuard (CASL/ABAC)', () => {
  let guard: PoliciesGuard;
  let reflector: Reflector;
  let moduleRef: { get: jest.Mock; resolve: jest.Mock };

  /** Metadata handler đăng ký cho guard (giả lập decorator). */
  let handlerMetadata: PolicyHandler[] | undefined;
  let classMetadata: PolicyHandler[] | undefined;
  let resourceMetadata: PolicyResourceMetadata | undefined;

  const makeContext = (req: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as unknown as ExecutionContext;

  const makeUser = (over: Partial<CurrentUser> = {}): CurrentUser =>
    ({
      userId: 'u1',
      email: 'a@b.c',
      role: 'user',
      workspaceIds: [],
      workspaceRoles: {},
      ownedWorkspaceIds: [],
      projectRoles: {},
      ...over,
    }) as CurrentUser;

  beforeEach(async () => {
    handlerMetadata = undefined;
    classMetadata = undefined;
    resourceMetadata = undefined;

    reflector = {
      get: jest.fn((key: string, target: unknown) => {
        if (key === CHECK_POLICIES_KEY) {
          return target === 'class' ? classMetadata : handlerMetadata;
        }
        if (key === POLICY_RESOURCE_KEY) {
          return target === 'class' ? undefined : resourceMetadata;
        }
        return undefined;
      }),
    } as unknown as Reflector;

    moduleRef = {
      get: jest.fn(() => {
        throw new Error('Not found');
      }),
      resolve: jest.fn(async () => {
        throw new Error('Not found');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesGuard,
        CaslAbilityFactory,
        { provide: Reflector, useValue: reflector },
        { provide: 'ModuleRef', useValue: moduleRef },
      ],
    }).compile();

    // PoliciesGuard dùng `ModuleRef` — override để inject fake.
    guard = new PoliciesGuard(
      reflector,
      module.get(CaslAbilityFactory),
      moduleRef as never,
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tầng 0: không có policy / không có user
  // ───────────────────────────────────────────────────────────────────────────

  describe('điều kiện tiên quyết', () => {
    it('không có policy handler ⇒ cho qua', async () => {
      const ctx = makeContext({ user: makeUser() });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('không có user nhưng không có policy ⇒ cho qua', async () => {
      const ctx = makeContext({});
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('không có user NHƯNG có policy ⇒ 403', async () => {
      handlerMetadata = [() => true];
      const ctx = makeContext({});
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tầng 1: static check
  // ───────────────────────────────────────────────────────────────────────────

  describe('tầng tĩnh (static check)', () => {
    it('admin được phép mọi thứ', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Manage, 'all')];
      const ctx = makeContext({ user: makeUser({ role: 'admin' }) });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('user thường được đọc Workspace của workspace mình sở hữu', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Workspace')];
      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('user thường KHÔNG có workspace nào ⇒ 403 static check', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Update, 'Workspace')];
      const ctx = makeContext({ user: makeUser() });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('subject dạng object (có __type) cũng được static check', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, { __type: 'Workspace' } as never)];
      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('handler trả false ⇒ 403 (policy check failed)', async () => {
      handlerMetadata = [() => false];
      const ctx = makeContext({ user: makeUser({ role: 'admin' }) });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tầng 2: dynamic resource loader (chống IDOR)
  // ───────────────────────────────────────────────────────────────────────────

  describe('tầng động (dynamic resource loader)', () => {
    class FakeLoader {
      async load(): Promise<unknown> {
        return null;
      }
    }

    it('resource không tồn tại ⇒ 404', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Workspace')];
      resourceMetadata = {
        subject: 'Workspace',
        loader: FakeLoader as never,
        param: 'id',
      };
      moduleRef.get = jest.fn(() => ({ load: async () => null }));

      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user, params: { id: 'ws-x' } });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('resource thuộc workspace khác ⇒ 403 (chống IDOR)', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Update, 'Workspace')];
      resourceMetadata = {
        subject: 'Workspace',
        loader: FakeLoader as never,
        param: 'id',
      };
      // ws2 không thuộc user (user chỉ sở hữu ws1).
      moduleRef.get = jest.fn(() => ({
        load: async () => ({ id: 'ws2', workspaceId: 'ws2', ownerId: 'u-other' }),
      }));

      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user, params: { id: 'ws2' } });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('resource thuộc workspace của user ⇒ cho qua', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Update, 'Workspace')];
      resourceMetadata = {
        subject: 'Workspace',
        loader: FakeLoader as never,
        param: 'id',
      };
      moduleRef.get = jest.fn(() => ({
        load: async () => ({ id: 'ws1', workspaceId: 'ws1', ownerId: 'u1' }),
      }));

      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user, params: { id: 'ws1' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('loader không có trong container ⇒ thử resolve()', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Workspace')];
      resourceMetadata = {
        subject: 'Workspace',
        loader: FakeLoader as never,
        param: 'id',
      };
      moduleRef.get = jest.fn(() => {
        throw new Error('Not found');
      });
      moduleRef.resolve = jest.fn(async () => ({
        load: async () => ({ id: 'ws1', workspaceId: 'ws1' }),
      }));

      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user, params: { id: 'ws1' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('loader trả về object không có hàm load ⇒ bỏ qua, không ném', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Workspace')];
      resourceMetadata = {
        subject: 'Workspace',
        loader: FakeLoader as never,
        param: 'id',
      };
      moduleRef.get = jest.fn(() => ({ notLoad: true }));

      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user, params: { id: 'ws1' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('thiếu route param ⇒ bỏ qua tầng động', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Workspace')];
      resourceMetadata = {
        subject: 'Workspace',
        loader: FakeLoader as never,
        param: 'workspaceId',
      };
      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user, params: {} });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('param tùy chỉnh (projectId) được dùng đúng', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Project')];
      resourceMetadata = {
        subject: 'Project',
        loader: FakeLoader as never,
        param: 'projectId',
      };
      const load = jest.fn(async () => ({ id: 'p1', workspaceId: 'ws1' }));
      moduleRef.get = jest.fn(() => ({ load }));

      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({ user, params: { projectId: 'p1' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(load).toHaveBeenCalledWith('p1', 'u1');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Resolve context (workspace / project)
  // ───────────────────────────────────────────────────────────────────────────

  describe('resolve workspace / project context', () => {
    it('gán workspaceIds / roles / ownedWorkspaceIds từ adapter', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Workspace')];
      moduleRef.get = jest.fn((token: symbol) => {
        if (token === WORKSPACE_CONTEXT_PORT) {
          return {
            resolve: async () => ({
              workspaceIds: ['ws1'],
              roles: { ws1: 'owner' },
              ownedWorkspaceIds: ['ws1'],
            }),
          };
        }
        return undefined;
      });

      const user = makeUser();
      delete user.workspaceIds;
      const ctx = makeContext({ user });
      await guard.canActivate(ctx);

      expect(user.workspaceIds).toEqual(['ws1']);
      expect(user.ownedWorkspaceIds).toEqual(['ws1']);
      expect(user.workspaceRoles).toEqual({ ws1: 'owner' });
    });

    it('gán projectRoles từ adapter', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Project')];
      moduleRef.get = jest.fn((token: symbol) => {
        if (token === PROJECT_CONTEXT_PORT) {
          return {
            resolve: async () => ({
              projectIds: ['p1'],
              roles: { p1: 'owner' },
              workspaceIds: { p1: 'ws1' },
            }),
          };
        }
        return undefined;
      });

      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      delete user.projectRoles;
      const ctx = makeContext({ user });
      await guard.canActivate(ctx);

      expect(user.projectRoles).toEqual({ p1: 'owner' });
    });

    it('adapter không được bind ⇒ fail-safe, không ném', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'User')];
      moduleRef.get = jest.fn(() => {
        throw new Error('Not found');
      });

      const user = makeUser();
      const ctx = makeContext({ user });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('user đã có workspaceIds ⇒ không gọi lại adapter', async () => {
      handlerMetadata = [(ctx) => ctx.can(Action.Read, 'Workspace')];
      const resolve = jest.fn(async () => ({
        workspaceIds: ['ws-other'],
        roles: {},
        ownedWorkspaceIds: [],
      }));
      moduleRef.get = jest.fn((token: symbol) => {
        if (token === WORKSPACE_CONTEXT_PORT) return { resolve };
        return undefined;
      });

      const user = makeUser({ workspaceIds: ['ws1'], ownedWorkspaceIds: ['ws1'] });
      const ctx = makeContext({ user });
      await guard.canActivate(ctx);

      expect(resolve).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Proxy context: các trường expose
  // ───────────────────────────────────────────────────────────────────────────

  describe('PolicyContext expose đủ trường', () => {
    it('ctx.user / ctx.params / ctx.body / ctx.query / ctx.request truy cập được', async () => {
      let seen: Record<string, unknown> = {};
      handlerMetadata = [
        (ctx) => {
          seen = {
            userId: ctx.user.userId,
            paramId: ctx.params.id,
            body: ctx.body,
            query: ctx.query,
            hasRequest: ctx.request !== undefined,
            hasAbility: ctx.ability !== undefined,
          };
          return ctx.can(Action.Read, 'Workspace');
        },
      ];
      const user = makeUser({ ownedWorkspaceIds: ['ws1'], workspaceIds: ['ws1'] });
      const ctx = makeContext({
        user,
        params: { id: 'p1' },
        body: { a: 1 },
        query: { q: 'x' },
      });
      await guard.canActivate(ctx);

      expect(seen.userId).toBe('u1');
      expect(seen.paramId).toBe('p1');
      expect(seen.body).toEqual({ a: 1 });
      expect(seen.query).toEqual({ q: 'x' });
      expect(seen.hasRequest).toBe(true);
      expect(seen.hasAbility).toBe(true);
    });
  });
});
