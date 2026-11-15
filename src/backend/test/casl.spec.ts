import { CaslAbilityFactory, CurrentUser } from '../src/shared/casl/casl-ability.factory';
import { Action } from '../src/shared/casl/actions.enum';
import { buildSubject } from '../src/shared/casl/subject.helper';

describe('CASL Authorization Engine (casl-ability.factory.ts)', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  describe('System Admin', () => {
    const adminUser: CurrentUser = {
      userId: 'admin_1',
      email: 'admin@system.com',
      role: 'admin',
    };

    it('should be able to manage all resources', () => {
      const ability = factory.createForUser(adminUser);
      expect(ability.can(Action.Manage, 'all')).toBe(true);
      expect(ability.can(Action.Delete, 'Workspace')).toBe(true);
      expect(ability.can(Action.Manage, 'Dataset')).toBe(true);
    });
  });

  describe('Workspace Owner', () => {
    const ownerUser: CurrentUser = {
      userId: 'user_owner',
      email: 'owner@workspace.com',
      role: 'analyst',
      workspaceId: 'ws_123',
      workspaceRole: 'owner',
    };

    it('should be able to manage workspace and all datasets inside its workspace', () => {
      const ability = factory.createForUser(ownerUser);
      const myDataset = buildSubject('Dataset', { id: 'ds_1', workspace_id: 'ws_123' });
      const otherDataset = buildSubject('Dataset', { id: 'ds_2', workspace_id: 'ws_999' });

      expect(ability.can(Action.Manage, myDataset)).toBe(true);
      expect(ability.can(Action.Delete, myDataset)).toBe(true);
      expect(ability.can(Action.Manage, otherDataset)).toBe(false);
    });
  });

  describe('Workspace Member (v3: owner|member)', () => {
    const memberUser: CurrentUser = {
      userId: 'user_member',
      email: 'member@workspace.com',
      role: 'analyst',
      workspaceId: 'ws_123',
      workspaceRole: 'member',
    };

    it('should only be able to read resources in its workspace, and cannot create/update/delete/execute', () => {
      const ability = factory.createForUser(memberUser);
      const myDataset = buildSubject('Dataset', { id: 'ds_1', workspace_id: 'ws_123' });
      const myProject = buildSubject('Project', { id: 'prj_1', workspace_id: 'ws_123' });

      expect(ability.can(Action.Read, myDataset)).toBe(true);
      expect(ability.can(Action.Read, myProject)).toBe(true);
      expect(ability.can(Action.Create, 'Dataset')).toBe(false);
      expect(ability.can(Action.Create, 'Project')).toBe(false);
      expect(ability.can(Action.Update, myDataset)).toBe(false);
      expect(ability.can(Action.Delete, myDataset)).toBe(false);
      expect(ability.can(Action.Execute, 'Dataset')).toBe(false);
      expect(ability.can(Action.Delete, 'Workspace')).toBe(false);
    });
  });

  describe('Self User Profile', () => {
    const regularUser: CurrentUser = {
      userId: 'user_456',
      email: 'user@example.com',
      role: 'analyst',
    };

    it('should be able to read and update own profile, but not other users', () => {
      const ability = factory.createForUser(regularUser);
      const myProfile = buildSubject('User', { id: 'user_456' });
      const otherProfile = buildSubject('User', { id: 'user_999' });

      expect(ability.can(Action.Read, myProfile)).toBe(true);
      expect(ability.can(Action.Update, myProfile)).toBe(true);
      expect(ability.can(Action.Update, otherProfile)).toBe(false);
    });
  });
});
