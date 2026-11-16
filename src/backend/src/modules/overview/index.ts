/**
 * Public contract của module OVERVIEW.
 *
 * - `GET /overview/workspaces` — E3: tổng quan workspace của người dùng.
 * - `GET /overview/workspaces/:id` — E4: tổng quan một workspace.
 */

export { GetUserOverviewHandler } from './application/queries/get-user-overview.handler';
export { GetWorkspaceOverviewHandler } from './application/queries/get-workspace-overview.handler';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
