export const NOTIFICATION_TYPES = [
  'project_created',
  'project_deleted',
  'project_member_added',
  'issue_needs_info',
  'issue_resolved',
  'analysis_completed',
  'analysis_failed',
  'ai_analysis_ready',
  'report_ready',
  'security_alert',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const MANDATORY_NOTIFICATION_TYPES: NotificationType[] = [
  'issue_needs_info',
  'security_alert',
];

export function isMandatoryNotification(type: string, explicitFlag: boolean): boolean {
  if (explicitFlag) return true;
  return (MANDATORY_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export function shouldDispatch(enabled: boolean | undefined, mandatory: boolean): boolean {
  if (enabled === false && !mandatory) return false;
  return true;
}
