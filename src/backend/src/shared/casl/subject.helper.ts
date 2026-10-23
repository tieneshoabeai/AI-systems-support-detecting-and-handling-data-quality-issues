import { subject } from '@casl/ability';
import type { SubjectName } from './subjects.type';

export function buildSubject<T extends Record<string, unknown>>(
  subjectName: SubjectName,
  data: T
) {
  if (!data) return subjectName;

  const properties =
    typeof (data as unknown as { toObject: () => Record<string, unknown> }).toObject === 'function'
      ? (data as unknown as { toObject: () => Record<string, unknown> }).toObject()
      : data;

  const normalized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(properties)) {
    if (val && typeof val === 'object' && 'toString' in val && !(val instanceof Date)) {
      normalized[key] = (val as { toString: () => string }).toString();
    } else {
      normalized[key] = val;
    }
  }

  const idValue = properties.id || properties._id;
  normalized.id = idValue ? (idValue as { toString: () => string }).toString() : undefined;

  if (properties.workspace_id) {
    normalized.workspace_id = (properties.workspace_id as { toString: () => string }).toString();
  }
  if (properties.project_id) {
    normalized.project_id = (properties.project_id as { toString: () => string }).toString();
  }
  if (properties.dataset_id) {
    normalized.dataset_id = (properties.dataset_id as { toString: () => string }).toString();
  }
  if (properties.user_id) {
    normalized.user_id = (properties.user_id as { toString: () => string }).toString();
  }
  if (properties.owner_id) {
    normalized.owner_id = (properties.owner_id as { toString: () => string }).toString();
  }

  return subject(subjectName, normalized);
}
