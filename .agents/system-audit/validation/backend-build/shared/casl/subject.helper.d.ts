import type { SubjectName } from './subjects.type';
export declare function buildSubject<T extends Record<string, unknown>>(subjectName: SubjectName, data: T): SubjectName | (Record<string, unknown> & import("@casl/ability").ForcedSubject<SubjectName>);
