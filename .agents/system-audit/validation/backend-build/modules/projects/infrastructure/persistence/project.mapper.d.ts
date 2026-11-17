import { Types } from 'mongoose';
import type { IProject } from './project.schema';
import type { ProjectMemberRecord, ProjectRecord } from '../../domain/ports/project.repository.port';
export declare function toProjectRecord(doc: IProject): ProjectRecord;
export declare function toMemberPersistence(m: ProjectMemberRecord): {
    user_id: Types.ObjectId;
    role: ProjectMemberRecord['role'];
    joined_at: Date;
};
