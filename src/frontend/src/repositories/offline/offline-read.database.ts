import Dexie from 'dexie'
import type { Table } from 'dexie'

export type OfflineRead = {
  accountId: string; namespace: string; key: string; payload: unknown; savedAt: number; bytes: number
}

export class OfflineReadDatabase extends Dexie {
  reads!: Table<OfflineRead, [string, string, string]>
  constructor(name = 'data-quality.offline-reads.v1') {
    super(name)
    this.version(1).stores({ reads: '[accountId+namespace+key], [accountId+namespace], accountId, savedAt' })
  }
}
