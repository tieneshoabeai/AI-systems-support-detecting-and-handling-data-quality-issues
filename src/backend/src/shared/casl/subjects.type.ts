export type SubjectName =
  | 'all'
  | 'Workspace'
  | 'Project'
  | 'Dataset'
  | 'DataRecord'
  | 'Analysis'
  | 'User'
  | 'Session'
  | 'Notification'
  | 'IssueReport'
  | 'FindingFeedback';

export type AppSubjects = SubjectName | Record<string, unknown>;
