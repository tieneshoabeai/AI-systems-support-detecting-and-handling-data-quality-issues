/**
 * Unit test thuần cho aggregate `Project` (Bước 3 — Rich Domain Model).
 *
 * Không dùng NestJS/Mongoose — chỉ kiểm tra hành vi + invariant của entity.
 */
import { Project } from '../src/modules/projects/domain/entities/project.entity';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../src/shared/domain/errors';

const WS = 'ws-1';
const OWNER = 'user-owner';
const MEMBER = 'user-member';
const VIEWER = 'user-viewer';

function buildProject(
  overrides: Partial<{
    status: 'not_started' | 'in_progress' | 'completed';
    hasDataset: boolean;
    members: Array<{ userId: string; role: 'owner' | 'member' | 'viewer'; joinedAt: Date }>;
  }> = {},
): Project {
  return Project.reconstitute({
    id: 'prj-1',
    workspaceId: WS,
    name: 'Dự án A',
    description: 'Mô tả',
    hasDataset: overrides.hasDataset ?? false,
    status: overrides.status ?? 'not_started',
    members: overrides.members ?? [
      { userId: OWNER, role: 'owner', joinedAt: new Date('2026-01-01') },
    ],
    lastAccessedAt: null,
    createdBy: OWNER,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    version: 1,
  });
}

describe('Project entity — factory & truy vấn', () => {
  it('create() tạo project với người tạo là Owner duy nhất', () => {
    const project = Project.create({
      id: 'prj-new',
      workspaceId: WS,
      name: 'Dự án mới',
      createdBy: OWNER,
    });

    expect(project.id).toBe('prj-new');
    expect(project.workspaceId).toBe(WS);
    expect(project.name).toBe('Dự án mới');
    expect(project.description).toBe('');
    expect(project.hasDataset).toBe(false);
    expect(project.status).toBe('not_started');
    expect(project.members).toHaveLength(1);
    expect(project.owner?.userId).toBe(OWNER);
    expect(project.version).toBe(1);
  });

  it('create() với ownerId chỉ định → owner là người được chỉ định', () => {
    const project = Project.create({
      id: 'prj-new',
      workspaceId: WS,
      name: 'Dự án mới',
      createdBy: OWNER,
      ownerId: MEMBER,
    });

    expect(project.owner?.userId).toBe(MEMBER);
    expect(project.createdBy).toBe(OWNER);
  });

  it('create() phát domain event project.created', () => {
    const project = Project.create({
      id: 'prj-new',
      workspaceId: WS,
      name: 'Dự án mới',
      createdBy: OWNER,
    });

    expect(project.domainEvents).toHaveLength(1);
    expect(project.domainEvents[0]?.eventType).toBe('project.created');
  });

  it('reconstitute() không phát domain event', () => {
    const project = buildProject();
    expect(project.domainEvents).toHaveLength(0);
  });

  it('dispatchDomainEvents() lấy ra event rồi xoá khỏi entity', () => {
    const project = Project.create({
      id: 'prj-new',
      workspaceId: WS,
      name: 'Dự án mới',
      createdBy: OWNER,
    });

    const events = project.dispatchDomainEvents();
    expect(events).toHaveLength(1);
    expect(project.dispatchDomainEvents()).toHaveLength(0);
  });

  it('roleOf / isMember trả về đúng vai trò', () => {
    const project = buildProject({
      members: [
        { userId: OWNER, role: 'owner', joinedAt: new Date() },
        { userId: MEMBER, role: 'member', joinedAt: new Date() },
      ],
    });

    expect(project.roleOf(OWNER)).toBe('owner');
    expect(project.roleOf(MEMBER)).toBe('member');
    expect(project.roleOf(VIEWER)).toBeNull();
    expect(project.isMember(MEMBER)).toBe(true);
    expect(project.isMember(VIEWER)).toBe(false);
  });
});

describe('Project entity — rename()', () => {
  it('đổi tên và mô tả', () => {
    const project = buildProject();
    project.rename('Tên mới', 'Mô tả mới');

    expect(project.name).toBe('Tên mới');
    expect(project.description).toBe('Mô tả mới');
  });

  it('tên rỗng → ValidationError', () => {
    const project = buildProject();
    expect(() => project.rename('   ')).toThrow(ValidationError);
  });

  it('tên quá 100 ký tự → ValidationError', () => {
    const project = buildProject();
    expect(() => project.rename('x'.repeat(101))).toThrow(ValidationError);
  });

  it('mô tả quá 500 ký tự → ValidationError', () => {
    const project = buildProject();
    expect(() => project.rename(undefined, 'y'.repeat(501))).toThrow(ValidationError);
  });
});

describe('Project entity — addMember()', () => {
  it('thêm thành viên mới với role mặc định là viewer', () => {
    const project = buildProject();
    project.addMember(MEMBER);

    expect(project.members).toHaveLength(2);
    expect(project.roleOf(MEMBER)).toBe('viewer');
  });

  it('thêm thành viên đã có → ConflictError', () => {
    const project = buildProject();
    expect(() => project.addMember(OWNER)).toThrow(ConflictError);
  });

  it('phát domain event project.member_added', () => {
    const project = buildProject();
    project.addMember(MEMBER);

    const events = project.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('project.member_added');
  });
});

describe('Project entity — removeMember()', () => {
  it('xoá được thành viên thường', () => {
    const project = buildProject({
      members: [
        { userId: OWNER, role: 'owner', joinedAt: new Date() },
        { userId: MEMBER, role: 'member', joinedAt: new Date() },
      ],
    });

    project.removeMember(MEMBER);
    expect(project.roleOf(MEMBER)).toBeNull();
  });

  it('xoá Owner → ValidationError (phải nhượng quyền trước — PROJ-11)', () => {
    const project = buildProject();
    expect(() => project.removeMember(OWNER)).toThrow(ValidationError);
  });

  it('xoá người không phải thành viên → NotFoundError', () => {
    const project = buildProject();
    expect(() => project.removeMember(VIEWER)).toThrow(NotFoundError);
  });
});

describe('Project entity — changeMemberRole()', () => {
  it('đổi được vai trò của thành viên thường', () => {
    const project = buildProject({
      members: [
        { userId: OWNER, role: 'owner', joinedAt: new Date() },
        { userId: MEMBER, role: 'member', joinedAt: new Date() },
      ],
    });

    project.changeMemberRole(MEMBER, 'viewer');
    expect(project.roleOf(MEMBER)).toBe('viewer');
  });

  it('đổi vai trò Owner → ValidationError (dùng nhượng quyền — PROJ-11)', () => {
    const project = buildProject();
    expect(() => project.changeMemberRole(OWNER, 'member')).toThrow(ValidationError);
  });

  it('đổi vai trò người không phải thành viên → NotFoundError', () => {
    const project = buildProject();
    expect(() => project.changeMemberRole(VIEWER, 'member')).toThrow(NotFoundError);
  });
});

describe('Project entity — transferOwnershipTo()', () => {
  it('chuyển quyền cho thành viên khác: owner cũ xuống member', () => {
    const project = buildProject({
      members: [
        { userId: OWNER, role: 'owner', joinedAt: new Date() },
        { userId: MEMBER, role: 'member', joinedAt: new Date() },
      ],
    });

    project.transferOwnershipTo(OWNER, MEMBER);

    expect(project.owner?.userId).toBe(MEMBER);
    expect(project.roleOf(OWNER)).toBe('member');
  });

  it('người không phải Owner không thể nhượng quyền → ForbiddenError', () => {
    const project = buildProject({
      members: [
        { userId: OWNER, role: 'owner', joinedAt: new Date() },
        { userId: MEMBER, role: 'member', joinedAt: new Date() },
      ],
    });

    expect(() => project.transferOwnershipTo(MEMBER, OWNER)).toThrow(ForbiddenError);
  });

  it('nhượng cho chính mình → ValidationError', () => {
    const project = buildProject();
    expect(() => project.transferOwnershipTo(OWNER, OWNER)).toThrow(ValidationError);
  });

  it('nhượng cho người không phải thành viên → ValidationError', () => {
    const project = buildProject();
    expect(() => project.transferOwnershipTo(OWNER, VIEWER)).toThrow(ValidationError);
  });
});

describe('Project entity — setHasDataset() & markCompleted()', () => {
  it('có dataset + chưa completed → status in_progress', () => {
    const project = buildProject({ status: 'not_started' });
    project.setHasDataset(true);

    expect(project.hasDataset).toBe(true);
    expect(project.status).toBe('in_progress');
  });

  it('bỏ dataset → status trở về not_started', () => {
    const project = buildProject({ status: 'in_progress', hasDataset: true });
    project.setHasDataset(false);

    expect(project.hasDataset).toBe(false);
    expect(project.status).toBe('not_started');
  });

  it('xoá dataset khi project đã completed → trở về not_started (đặc tả §3.36.1)', () => {
    const project = buildProject({ status: 'completed', hasDataset: true });
    project.setHasDataset(false);

    expect(project.status).toBe('not_started');
  });

  it('giữ nguyên completed khi vẫn còn dataset', () => {
    const project = buildProject({ status: 'completed', hasDataset: true });
    project.setHasDataset(true);

    expect(project.status).toBe('completed');
  });

  it('markCompleted() khi in_progress → completed', () => {
    const project = buildProject({ status: 'in_progress', hasDataset: true });
    project.markCompleted();

    expect(project.status).toBe('completed');
  });

  it('markCompleted() khi chưa in_progress → ValidationError', () => {
    const project = buildProject({ status: 'not_started' });
    expect(() => project.markCompleted()).toThrow(ValidationError);
  });
});

describe('Project entity — assertCanModerate / assertCanAccess', () => {
  it('PROJ-OWNER được điều hành', () => {
    const project = buildProject();
    expect(() => project.assertCanModerate('owner', null)).not.toThrow();
  });

  it('WS-OWNER được điều hành mọi project trong workspace', () => {
    const project = buildProject();
    expect(() => project.assertCanModerate('viewer', 'owner')).not.toThrow();
  });

  it('PROJ-VIEWER không được điều hành → ForbiddenError', () => {
    const project = buildProject();
    expect(() => project.assertCanModerate('viewer', null)).toThrow(ForbiddenError);
  });

  it('PROJ-MEMBER được đọc', () => {
    const project = buildProject();
    expect(() => project.assertCanAccess('member', null)).not.toThrow();
  });

  it('WS-MEMBER được đọc project (đặc tả WS-07: mặc định là PROJ-VIEWER)', () => {
    const project = buildProject();
    expect(() => project.assertCanAccess(null, 'member')).not.toThrow();
  });

  it('WS-OWNER được đọc mọi project trong workspace', () => {
    const project = buildProject();
    expect(() => project.assertCanAccess(null, 'owner')).not.toThrow();
  });

  it('PROJ-VIEWER được đọc (chỉ-đọc — khớp CASL mục 4c)', () => {
    const project = buildProject();
    expect(() => project.assertCanAccess('viewer', null)).not.toThrow();
  });

  it('không có quan hệ nào → ForbiddenError', () => {
    const project = buildProject();
    expect(() => project.assertCanAccess(null, null)).toThrow(ForbiddenError);
  });
});

describe('Project entity — toProps()', () => {
  it('toProps() trả về bản chụp props đầy đủ', () => {
    const project = buildProject();
    const props = project.toProps();

    expect(props.id).toBe('prj-1');
    expect(props.workspaceId).toBe(WS);
    expect(props.name).toBe('Dự án A');
    expect(props.members).toHaveLength(1);
    expect(props.version).toBe(1);
  });
});
