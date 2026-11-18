import type { Type } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import type { SubjectName } from '../../domain/security/subjects';
import type { PolicyResourceLoader } from '../../domain/security/policy-resource-loader';
import type { CustomDecorator } from '@nestjs/common';

export const POLICY_RESOURCE_KEY = 'policy_resource';

/**
 * `PolicyResourceLoader` được khai báo ở `shared/domain/security/`
 * (tầng Domain) vì policy loader ở tầng Application hiện thực interface này.
 * Vẫn re-export tại đây để giữ public contract cũ của decorator.
 */
export type { PolicyResourceLoader };

export interface PolicyResourceMetadata {
  /**
   * Loại subject mà resource thuộc về — dùng để đối chiếu với subject trong
   * `@CheckPolicies`. Nếu khớp, `PoliciesGuard` sẽ thay subject bằng **instance
   * thật** khi kiểm tra ở tầng động (chống IDOR).
   */
  subject: SubjectName;
  loader: Type<PolicyResourceLoader>;
  /**
   * Tên route param chứa id của tài nguyên. Mặc định `'id'`.
   * Ví dụ: `projects/:projectId/analysis` → `param: 'projectId'`.
   */
  param?: string;
}

export const PolicyResource = (
  subject: SubjectName,
  loader: Type<PolicyResourceLoader>,
  param = 'id',
): CustomDecorator<string> =>
  SetMetadata(POLICY_RESOURCE_KEY, {
    subject,
    loader,
    param,
  } as PolicyResourceMetadata);
