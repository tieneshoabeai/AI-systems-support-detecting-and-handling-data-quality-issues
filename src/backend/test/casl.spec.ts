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
      expect(ability.can(Action.Execute, 'CleanRule')).toBe(true);
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

  describe('Workspace Editor', () => {
    const editorUser: CurrentUser = {
      userId: 'user_editor',
      email: 'editor@workspace.com',
      role: 'analyst',
      workspaceId: 'ws_123',
      workspaceRole: 'editor',
    };

    it('should be able to create, read, update, execute rules in workspace, but cannot delete workspace or dataset', () => {
      const ability = factory.createForUser(editorUser);
      const myDataset = buildSubject('Dataset', { id: 'ds_1', workspace_id: 'ws_123' });
      const myCleanRule = buildSubject('CleanRule', { id: 'cr_1', workspace_id: 'ws_123' });

      expect(ability.can(Action.Create, 'Dataset')).toBe(true);
      expect(ability.can(Action.Update, myDataset)).toBe(true);
      expect(ability.can(Action.Execute, myCleanRule)).toBe(true);
      expect(ability.can(Action.Delete, myDataset)).toBe(false);
      expect(ability.can(Action.Delete, 'Workspace')).toBe(false);
    });
  });

  describe('Workspace Viewer', () => {
    const viewerUser: CurrentUser = {
      userId: 'user_viewer',
      email: 'viewer@workspace.com',
      role: 'analyst',
      workspaceId: 'ws_123',
      workspaceRole: 'viewer',
    };

    it('should only be able to read resources in its workspace, and cannot create or update', () => {
      const ability = factory.createForUser(viewerUser);
      const myDataset = buildSubject('Dataset', { id: 'ds_1', workspace_id: 'ws_123' });

      expect(ability.can(Action.Read, myDataset)).toBe(true);
      expect(ability.can(Action.Create, 'Dataset')).toBe(false);
      expect(ability.can(Action.Update, myDataset)).toBe(false);
      expect(ability.can(Action.Delete, myDataset)).toBe(false);
      expect(ability.can(Action.Execute, 'CleanRule')).toBe(false);
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
