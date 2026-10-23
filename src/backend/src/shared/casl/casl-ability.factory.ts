import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { Action } from './actions.enum';
import type { AppSubjects } from './subjects.type';

export interface CurrentUser {
  userId: string;
  email: string;
  role: 'admin' | 'analyst';
  sessionId?: string;
  workspaceId?: string;
  workspaceRole?: 'owner' | 'editor' | 'viewer';
}

export type AppAbility = MongoAbility<[Action, AppSubjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: CurrentUser): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // 1. Quản trị viên hệ thống (System Admin): Toàn quyền trên mọi thực thể
    if (user.role === 'admin') {
      can(Action.Manage, 'all');
      return build();
    }

    // 2. Quyền cá nhân: Xem/sửa profile của chính mình và quản lý sessions cá nhân
    can([Action.Read, Action.Update], 'User', { id: user.userId });
    can([Action.Read, Action.Delete], 'Session', { user_id: user.userId });

    // 3. Phân quyền theo vai trò trong Workspace hiện tại
    if (user.workspaceId && user.workspaceRole) {
      switch (user.workspaceRole) {
        case 'owner':
          can(Action.Manage, 'Workspace', { id: user.workspaceId });
          can(
            Action.Manage,
            [
              'Project',
              'Dataset',
              'DataRecord',
              'CleanRule',
              'DatasetVersion',
              'Lineage',
              'ExportTask',
            ],
            { workspace_id: user.workspaceId }
          );
          break;

        case 'editor':
          can(Action.Read, 'Workspace', { id: user.workspaceId });
          can(
            [
              Action.Create,
              Action.Read,
              Action.Update,
              Action.Execute,
              Action.Export,
            ],
            [
              'Project',
              'Dataset',
              'DataRecord',
              'CleanRule',
              'DatasetVersion',
              'Lineage',
              'ExportTask',
            ],
            { workspace_id: user.workspaceId }
          );
          // Editor không được quyền xóa Workspace hoặc Dataset
          cannot(Action.Delete, 'Workspace');
          cannot(Action.Delete, 'Dataset');
          break;

        case 'viewer':
          can(
            Action.Read,
            [
              'Workspace',
              'Project',
              'Dataset',
              'DataRecord',
              'CleanRule',
              'DatasetVersion',
              'Lineage',
              'ExportTask',
            ],
            { workspace_id: user.workspaceId }
          );
          cannot(
            [Action.Create, Action.Update, Action.Delete, Action.Execute],
            'all'
          );
          break;
      }
    }

    return build();
  }
}
