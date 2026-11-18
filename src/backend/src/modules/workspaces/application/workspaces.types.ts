/**
 * WORKSPACES — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

export const DEFAULT_LIMIT = 15;

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  member_emails?: string[];
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  expectedVersion?: number;
}

export interface AddWorkspaceMemberInput {
  email: string;
  role?: 'owner' | 'member';
}

export interface TransferWorkspaceOwnerInput {
  email: string;
  expectedVersion: number;
}
