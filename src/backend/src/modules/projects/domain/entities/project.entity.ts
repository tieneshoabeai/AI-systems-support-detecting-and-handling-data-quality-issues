import { canAccessProject, canModerateProject } from '../value-objects/project-role.vo';

export interface ProjectMemberProps {
  userId: string;
  role: 'owner' | 'member' | 'viewer';
  joinedAt: Date;
}

export interface ProjectProps {
  id: string;
  workspaceId: string;
  name: string;
  hasDataset: boolean;
  members: ProjectMemberProps[];
}

export class Project {
  private constructor(private readonly props: ProjectProps) {}

  static create(props: ProjectProps): Project {
    return new Project({ ...props, members: [...props.members] });
  }

  get hasDataset(): boolean {
    return this.props.hasDataset;
  }

  assertNoActiveDataset(message = 'Project da co Dataset'): void {
    if (this.props.hasDataset) {
      throw new Error(message);
    }
  }

  assertCanModerate(projectRole: string | null, workspaceRole: string | null): void {
    if (!canModerateProject(projectRole, workspaceRole)) {
      throw new Error('Khong co quyen dieu hanh project');
    }
  }

  assertCanAccess(projectRole: string | null, workspaceRole: string | null): void {
    if (!canAccessProject(projectRole, workspaceRole)) {
      throw new Error('Khong co quyen truy cap project');
    }
  }
}
