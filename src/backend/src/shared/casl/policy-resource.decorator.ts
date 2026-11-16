import type { Type } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import type { SubjectName } from './subjects.type';
import type { CustomDecorator } from '@nestjs/common';

export const POLICY_RESOURCE_KEY = 'policy_resource';

export interface PolicyResourceLoader {
  load(id: string, workspaceId?: string): Promise<unknown>;
}

export interface PolicyResourceMetadata {
  subject: SubjectName;
  loader: Type<PolicyResourceLoader>;
}

export const PolicyResource = (subject: SubjectName, loader: Type<PolicyResourceLoader>) : CustomDecorator<string> =>
  SetMetadata(POLICY_RESOURCE_KEY, { subject, loader } as PolicyResourceMetadata);
