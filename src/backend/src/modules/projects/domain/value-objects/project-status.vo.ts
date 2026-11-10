export const PROJECT_STATUSES = ['not_started', 'in_progress', 'completed'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isProjectCompleted(status: string): boolean {
  return status === 'completed';
}
