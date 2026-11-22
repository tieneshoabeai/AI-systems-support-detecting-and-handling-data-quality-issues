/**
 * Public contract của lớp cơ sở entity nghiệp vụ.
 *
 * Tầng `domain` trong mọi module import qua `index.ts` này (CA8 — cross-module
 * import phải đi qua public contract).
 */

export { BaseEntity, type BaseEntityProps, type DomainEvent } from './base-entity';
