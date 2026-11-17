export declare const PROJECT_STATUSES: readonly ['not_started', 'in_progress', 'completed'];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export declare function isProjectCompleted(status: string): boolean;
