/**
 * PROJECTS — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

export const DEFAULT_LIMIT = 15;

export interface CreateProjectInput {
  name: string;
  description?: string;
  owner_id?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  expectedVersion?: number;
}

export interface AddProjectMemberInput {
  email: string;
  role?: 'member' | 'viewer';
}

export interface UpdateProjectMemberInput {
  role: 'member' | 'viewer';
  expectedVersion: number;
}

export interface TransferProjectOwnerInput {
  email: string;
  expectedVersion: number;
}
