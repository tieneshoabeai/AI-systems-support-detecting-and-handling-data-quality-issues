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
  workspaceRole?: 'owner' | 'member';
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
    can(Action.Read, 'Notification', { user_id: user.userId });
    can(Action.Update, 'Notification', { user_id: user.userId });
    can([Action.Create, Action.Read], 'IssueReport', { user_id: user.userId });
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
              'Analysis',
            ],
            { workspace_id: user.workspaceId }
          );
          break;

        case 'member':
          // WS-MEMBER (v3): quyền ĐỌC ở cấp workspace — xem workspace,
          // danh sách thành viên, tổng quan và danh sách project.
          // Đồng thời là PROJ-VIEWER mặc định trong mọi project -> được đọc
          // dữ liệu project (Project/Dataset/...) nhưng không ghi.
          can(Action.Read, 'Workspace', { id: user.workspaceId });
          can(
            Action.Read,
            [
              'Project',
              'Dataset',
              'DataRecord',
              'Analysis',
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
