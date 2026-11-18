/**
 * PROJECTS — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 */

import {
  type GenericSortSpec,
  type SortValueAccessor,
} from '../../../shared/domain/pagination/keyset-generic-memory.util';

export function projectMemberSortSpec<
  T extends {
    role: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    joinedAt: Date;
  },
>(sort: string): GenericSortSpec<T> {
  const displayName = (item: T): string => {
    const full = `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
    return full || item.email || '';
  };
  switch (sort) {
    case 'name_desc':
      return { code: sort, accessor: displayName as SortValueAccessor<T>, direction: -1 };
    case 'joined':
      return {
        code: sort,
        accessor: ((item: T) => item.joinedAt.toISOString()) as SortValueAccessor<T>,
        toNumber: (v: string) => Date.parse(v),
        direction: -1,
      };
    case 'role':
      return {
        code: sort,
        accessor: ((item: T) => item.role) as SortValueAccessor<T>,
        direction: 1,
      };
    case 'name_asc':
    default:
      return { code: 'name_asc', accessor: displayName as SortValueAccessor<T>, direction: 1 };
  }
}
