import { Type } from '@nestjs/common';
import type { SubjectName } from './subjects.type';
export declare const POLICY_RESOURCE_KEY = "policy_resource";
export interface PolicyResourceLoader {
    load(id: string, workspaceId?: string): Promise<unknown>;
}
export interface PolicyResourceMetadata {
    subject: SubjectName;
    loader: Type<PolicyResourceLoader>;
}
export declare const PolicyResource: (subject: SubjectName, loader: Type<PolicyResourceLoader>) => import("@nestjs/common").CustomDecorator<string>;
