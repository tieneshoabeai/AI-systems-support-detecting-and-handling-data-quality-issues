import { Workspace } from '../../../src/modules/workspaces/domain/entities/workspace.entity';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../src/shared/domain/errors';

/**
 * Bước 3 — Rich Domain Model: unit test thuần Node cho aggregate `Workspace`.
 *
 * Không cần NestJS testing module, không cần MongoDB (Phần 5 §3.3 — "toàn bộ
 * `domain/` test được bằng unit test thuần Node").
 */
describe('Workspace — aggregate root (Rich Domain Model)', () => {
  const OWNER = 'owner-1';
  const MEMBER = 'member-1';
  const OUTSIDER = 'outsider-1';

  const buildWorkspace = (
    overrides: Partial<{
      ownerId: string;
      members: Array<{ userId: string; role: 'owner' | 'member'; joinedAt: Date }>;
    }> = {},
  ): Workspace =>
    Workspace.reconstitute({
      id: 'ws-1',
      name: 'Data Team',
      description: 'Mô tả',
      ownerId: overrides.ownerId ?? OWNER,
      members: overrides.members ?? [
        { userId: OWNER, role: 'owner', joinedAt: new Date('2026-01-01') },
        { userId: MEMBER, role: 'member', joinedAt: new Date('2026-01-02') },
      ],
      storageUsedBytes: 0,
      lastAccessedAt: null,
      version: 1,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      deletedAt: null,
    });

  describe('factory', () => {
    it('create() — người tạo là Owner và phát domain event', () => {
      const ws = Workspace.create({ id: 'ws-9', name: 'Mới', ownerId: OWNER });

      expect(ws.ownerId).toBe(OWNER);
      expect(ws.name).toBe('Mới');
      expect(ws.description).toBe('');
      expect(ws.version).toBe(1);
      expect(ws.isOwner(OWNER)).toBe(true);
      expect(ws.members).toHaveLength(1);
      expect(ws.domainEvents).toHaveLength(1);
      expect(ws.domainEvents[0]?.eventType).toBe('workspace.created');
    });

    it('reconstitute() — không phát domain event', () => {
      const ws = buildWorkspace();
      expect(ws.domainEvents).toHaveLength(0);
      expect(ws.id).toBe('ws-1');
    });
  });

  describe('truy vấn vai trò', () => {
    it('isOwner / isMember / roleOf', () => {
      const ws = buildWorkspace();
      expect(ws.isOwner(OWNER)).toBe(true);
      expect(ws.isMember(MEMBER)).toBe(true);
      expect(ws.isMember(OUTSIDER)).toBe(false);
      expect(ws.roleOf(OWNER)).toBe('owner');
      expect(ws.roleOf(MEMBER)).toBe('member');
      expect(ws.roleOf(OUTSIDER)).toBeNull();
    });
  });

  describe('rename()', () => {
    it('đổi tên/mô tả thành công', () => {
      const ws = buildWorkspace();
      ws.rename('  Tên mới  ', 'Mô tả mới');
      expect(ws.name).toBe('Tên mới');
      expect(ws.description).toBe('Mô tả mới');
    });

    it('tên rỗng → ValidationError', () => {
      const ws = buildWorkspace();
      expect(() => ws.rename('   ')).toThrow(ValidationError);
    });

    it('tên quá dài → ValidationError', () => {
      const ws = buildWorkspace();
      expect(() => ws.rename('x'.repeat(101))).toThrow(ValidationError);
    });

    it('mô tả quá dài → ValidationError', () => {
      const ws = buildWorkspace();
      expect(() => ws.rename(undefined, 'y'.repeat(501))).toThrow(ValidationError);
    });
  });

  describe('addMember()', () => {
    it('thêm thành viên mới → OK + phát event', () => {
      const ws = buildWorkspace();
      ws.addMember(OUTSIDER);
      expect(ws.isMember(OUTSIDER)).toBe(true);
      expect(ws.domainEvents.map((e) => e.eventType)).toContain('workspace.member_added');
    });

    it('thêm người đã là thành viên → ConflictError', () => {
      const ws = buildWorkspace();
      expect(() => ws.addMember(MEMBER)).toThrow(ConflictError);
    });

    it('thêm chính Owner → ConflictError', () => {
      const ws = buildWorkspace();
      expect(() => ws.addMember(OWNER)).toThrow(ConflictError);
    });
  });

  describe('removeMember()', () => {
    it('xoá thành viên → OK + phát event', () => {
      const ws = buildWorkspace();
      ws.removeMember(MEMBER);
      expect(ws.isMember(MEMBER)).toBe(false);
      expect(ws.domainEvents.map((e) => e.eventType)).toContain('workspace.member_removed');
    });

    it('xoá Owner → ValidationError', () => {
      const ws = buildWorkspace();
      expect(() => ws.removeMember(OWNER)).toThrow(ValidationError);
    });

    it('xoá người không phải thành viên → NotFoundError', () => {
      const ws = buildWorkspace();
      expect(() => ws.removeMember(OUTSIDER)).toThrow(NotFoundError);
    });
  });

  describe('leave()', () => {
    it('thành viên rời được', () => {
      const ws = buildWorkspace();
      ws.leave(MEMBER);
      expect(ws.isMember(MEMBER)).toBe(false);
    });

    it('Owner rời → ValidationError (phải nhượng quyền trước)', () => {
      const ws = buildWorkspace();
      expect(() => ws.leave(OWNER)).toThrow(ValidationError);
    });

    it('người ngoài rời → NotFoundError', () => {
      const ws = buildWorkspace();
      expect(() => ws.leave(OUTSIDER)).toThrow(NotFoundError);
    });
  });

  describe('transferOwnershipTo()', () => {
    it('nhượng quyền thành công → đúng 1 Owner', () => {
      const ws = buildWorkspace();
      ws.transferOwnershipTo(OWNER, MEMBER);

      expect(ws.ownerId).toBe(MEMBER);
      expect(ws.roleOf(MEMBER)).toBe('owner');
      expect(ws.roleOf(OWNER)).toBe('member');
      // Vẫn đúng 1 Owner.
      expect(ws.members.filter((m) => m.role === 'owner')).toHaveLength(1);
      expect(ws.domainEvents.map((e) => e.eventType)).toContain('workspace.owner_transferred');
    });

    it('không phải Owner → ForbiddenError', () => {
      const ws = buildWorkspace();
      expect(() => ws.transferOwnershipTo(MEMBER, OUTSIDER)).toThrow(ForbiddenError);
    });

    it('nhượng cho chính mình → ValidationError', () => {
      const ws = buildWorkspace();
      expect(() => ws.transferOwnershipTo(OWNER, OWNER)).toThrow(ValidationError);
    });

    it('nhượng cho người không phải thành viên → ValidationError', () => {
      const ws = buildWorkspace();
      expect(() => ws.transferOwnershipTo(OWNER, OUTSIDER)).toThrow(ValidationError);
    });
  });

  describe('adjustStorageUsed()', () => {
    it('cộng/trừ dung lượng', () => {
      const ws = buildWorkspace();
      ws.adjustStorageUsed(100);
      expect(ws.storageUsedBytes).toBe(100);
      ws.adjustStorageUsed(-40);
      expect(ws.storageUsedBytes).toBe(60);
    });

    it('dung lượng âm → ValidationError', () => {
      const ws = buildWorkspace();
      expect(() => ws.adjustStorageUsed(-1)).toThrow(ValidationError);
    });
  });

  describe('dispatchDomainEvents()', () => {
    it('lấy và xoá event đang chờ', () => {
      const ws = Workspace.create({ id: 'ws-9', name: 'Mới', ownerId: OWNER });
      const events = ws.dispatchDomainEvents();
      expect(events).toHaveLength(1);
      expect(ws.domainEvents).toHaveLength(0);
    });
  });

  describe('toProps()', () => {
    it('xuất đủ state (dùng cho mapper persistence)', () => {
      const ws = buildWorkspace();
      const props = ws.toProps();
      expect(props.id).toBe('ws-1');
      expect(props.ownerId).toBe(OWNER);
      expect(props.members).toHaveLength(2);
      expect(props.version).toBe(1);
    });
  });
});
