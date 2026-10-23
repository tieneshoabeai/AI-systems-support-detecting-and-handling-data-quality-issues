import { SetMetadata, Type } from '@nestjs/common';
import type { SubjectName } from './subjects.type';

export const POLICY_RESOURCE_KEY = 'policy_resource';

export interface PolicyResourceLoader {
  load(id: string, workspaceId?: string): Promise<unknown>;
}

export interface PolicyResourceMetadata {
  subject: SubjectName;
  loader: Type<PolicyResourceLoader>;
}

export const PolicyResource = (subject: SubjectName, loader: Type<PolicyResourceLoader>) =>
  SetMetadata(POLICY_RESOURCE_KEY, { subject, loader } as PolicyResourceMetadata);
