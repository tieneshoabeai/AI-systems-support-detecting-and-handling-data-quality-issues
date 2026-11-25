import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { OfflineWrite } from '../../types/offline/offline-write.types'

export class OfflineWriteDatabase extends Dexie {
  writes!: Table<OfflineWrite, number>
  constructor(name = 'data-quality.offline-writes.v1') {
    super(name)
    this.version(1).stores({ writes: '++sequence, &id, [accountId+namespace], accountId' })
  }
}
