export type SubjectName =
  | 'all'
  | 'Workspace'
  | 'Project'
  | 'Dataset'
  | 'DataRecord'
  | 'CleanRule'
  | 'DatasetVersion'
  | 'Lineage'
  | 'ExportTask'
  | 'User'
  | 'Session';

export type AppSubjects = SubjectName | Record<string, unknown>;
