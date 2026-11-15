/**
 * PROJECT — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này. Không mongoose, không NestJS.
 */

export const PROJECT_REPOSITORY_PORT = Symbol('ProjectRepositoryPort');

export type ProjectMemberRole = 'owner' | 'member' | 'viewer';
export type ProjectStatus = 'not_started' | 'in_progress' | 'completed';

export interface ProjectMemberRecord {
  userId: string;
  role: ProjectMemberRole;
  joinedAt: Date;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  hasDataset: boolean;
  status: ProjectStatus;
  members: ProjectMemberRecord[];
  lastAccessedAt: Date | null;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectListQuery {
  search?: string;
  status?: ProjectStatus;
  sort?: 'last_accessed' | 'updated' | 'name_asc' | 'name_desc' | 'joined';
  page?: number;
  limit?: number;
}

export interface CreateProjectRecord {
  workspaceId: string;
  name: string;
  description: string;
  createdBy: string;
}

export interface AddProjectMemberRecord {
  userId: string;
  role: ProjectMemberRole;
}

export interface ProjectRepositoryPort {
  create(data: CreateProjectRecord): Promise<ProjectRecord>;
  findById(id: string): Promise<ProjectRecord | null>;
  findOneByWorkspaceAndName(workspaceId: string, name: string): Promise<ProjectRecord | null>;
  findByWorkspace(workspaceId: string): Promise<ProjectRecord[]>;
  findByWorkspacePaged(
    workspaceId: string,
    opts?: ProjectListQuery,
  ): Promise<{ items: ProjectRecord[]; total: number }>;
  updateById(id: string, update: { name?: string; description?: string }, expectedVersion?: number): Promise<ProjectRecord | null>;
  softDelete(id: string): Promise<boolean>;
  setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean>;
  setStatus(projectId: string, status: ProjectStatus): Promise<boolean>;
  touchLastAccessed(projectId: string): Promise<void>;
  addMember(projectId: string, member: AddProjectMemberRecord): Promise<boolean>;
  removeMember(projectId: string, userId: string): Promise<boolean>;
  updateMemberRole(projectId: string, userId: string, role: ProjectMemberRole, expectedVersion?: number): Promise<boolean | null>;
  transferOwner(projectId: string, newOwnerId: string, expectedVersion?: number): Promise<boolean | null>;
  markCompleted(projectId: string, expectedVersion: number): Promise<boolean | null>;
}
