export type CursorPage<T> = { items: T[]; meta?: { hasMore?: boolean; nextCursor?: string | null } }

export type Member = { userId: string; role: string; email?: string | null; name?: string; firstName?: string | null; lastName?: string | null; joinedAt?: string }

export type DatasetDto = { id: string; originalFileName: string; rowCount: number; columnCount: number; fileSizeBytes: number; createdAt: string; status: string }
