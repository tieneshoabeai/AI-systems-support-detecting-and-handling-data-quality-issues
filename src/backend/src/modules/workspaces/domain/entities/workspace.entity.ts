import { isWorkspaceMember, isWorkspaceOwner } from '../value-objects/workspace-role.vo';

export interface WorkspaceMemberProps {
  userId: string;
  role: 'owner' | 'member';
  joinedAt: Date;
}

export interface WorkspaceProps {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMemberProps[];
}

export class Workspace {
  private constructor(private readonly props: WorkspaceProps) {}

  static create(props: WorkspaceProps): Workspace {
    return new Workspace({ ...props, members: [...props.members] });
  }

  isOwner(userId: string): boolean {
    return isWorkspaceOwner(this.props.ownerId, userId);
  }

  isMember(userId: string): boolean {
    return isWorkspaceMember(this.props.members.map((m) => m.userId), userId);
  }

  assertActorIsOwner(actorUserId: string, message = 'Chi Workspace Owner moi duoc thuc hien'): void {
    if (!this.isOwner(actorUserId)) {
      throw new Error(message);
    }
  }

  assertCanRemoveMember(targetUserId: string): void {
    if (this.props.ownerId === targetUserId) {
      throw new Error('Khong the xoa chu so huu chinh cua khong gian lam viec');
    }
    if (!this.isMember(targetUserId)) {
      throw new Error('Nguoi dung khong thuoc danh sach thanh vien');
    }
  }

  assertCanTransfer(actorUserId: string, targetUserId: string): void {
    this.assertActorIsOwner(actorUserId, 'Chi Workspace Owner moi duoc nhuong quyen');
    if (actorUserId === targetUserId) {
      throw new Error('Khong the nhuong quyen cho chinh minh');
    }
    if (!this.isMember(targetUserId)) {
      throw new Error('Chi nhuong quyen cho thanh vien workspace');
    }
  }

  assertCanLeave(userId: string): void {
    if (this.props.ownerId === userId) {
      throw new Error('Workspace Owner phai nhuong quyen truoc khi roi');
    }
    if (!this.isMember(userId)) {
      throw new Error('Ban khong phai thanh vien workspace nay');
    }
  }
}
