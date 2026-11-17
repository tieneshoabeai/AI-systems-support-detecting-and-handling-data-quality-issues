export declare const NOTIFICATION_TYPES: readonly ['project_created', 'project_deleted', 'project_member_added', 'issue_needs_info', 'issue_resolved', 'analysis_completed', 'analysis_failed', 'ai_analysis_ready', 'report_ready', 'security_alert'];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export declare const MANDATORY_NOTIFICATION_TYPES: NotificationType[];
export declare function isMandatoryNotification(type: string, explicitFlag: boolean): boolean;
export declare function shouldDispatch(enabled: boolean | undefined, mandatory: boolean): boolean;
