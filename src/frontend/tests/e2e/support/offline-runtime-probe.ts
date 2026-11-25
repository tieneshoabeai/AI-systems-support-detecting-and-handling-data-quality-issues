import type { Page } from '@playwright/test'

type RuntimeProbe = { boot: string; reads: number }
type ProbeWindow = Window & { __offlineRuntimeProbe?: RuntimeProbe }

export async function installOfflineRuntimeProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = { boot: crypto.randomUUID(), reads: 0 }
    ;(window as ProbeWindow).__offlineRuntimeProbe = probe
    // eslint-disable-next-line @typescript-eslint/unbound-method -- The wrapper explicitly restores the native receiver with call(this).
    const get = IDBObjectStore.prototype.get
    IDBObjectStore.prototype.get = function (query) {
      if (this.name === 'reads') probe.reads += 1
      return get.call(this, query)
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method -- The wrapper explicitly restores the native receiver with call(this).
    const getAll = IDBObjectStore.prototype.getAll
    IDBObjectStore.prototype.getAll = function (query, count) {
      if (this.name === 'reads') probe.reads += 1
      return getAll.call(this, query, count)
    }
  })
}

export function readOfflineRuntimeProbe(page: Page) {
  return page.evaluate(() => ({ ...(window as ProbeWindow).__offlineRuntimeProbe, online: navigator.onLine }))
}

// Change only the browser copy of this test's synthetic row. The server and in-memory
// view retain QA001; displaying the marker after reload proves the new runtime read IDB.
export async function markOwnedIndexedDbRecord(page: Page, input: {
  accountId: string; namespace: string; datasetId: string; marker: string
}) {
  return page.evaluate(async ({ accountId, namespace, datasetId, marker }) => {
    const name = 'data-quality.offline-reads.v1'
    if (!(await indexedDB.databases()).some(database => database.name === name)) throw new Error('Offline database was not created by the app runtime.')
    return new Promise<{ patched: number; paths: string[] }>((resolve, reject) => {
      const opening = indexedDB.open(name)
      opening.onerror = () => reject(new Error('Cannot inspect the runtime offline database.'))
      opening.onsuccess = () => {
        const db = opening.result
        const tx = db.transaction('reads', 'readwrite')
        const store = tx.objectStore('reads')
        const all = store.getAll()
        let patched = 0
        const paths = new Set<string>()
        all.onsuccess = () => {
          const rows = all.result as { accountId: string; namespace: string; key: string; payload: { items?: { props?: Record<string, unknown> }[] } }[]
          for (const row of rows) {
            if (row.accountId !== accountId || row.namespace !== namespace) continue
            const key = JSON.parse(row.key) as { path: string }
            paths.add(key.path)
            if (![ `/datasets/${datasetId}/records`, `/datasets/${datasetId}/records/query` ].includes(key.path)
              || !Array.isArray(row.payload.items)) continue
            let changed = false
            for (const item of row.payload.items) {
              if (item.props?.['c0'] !== 'QA001') continue
              item.props['c0'] = marker
              changed = true
            }
            if (changed) { store.put(row); patched += 1 }
          }
        }
        tx.oncomplete = () => { db.close(); resolve({ patched, paths: [...paths].sort() }) }
        tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Cannot inspect or mark the owned synthetic cache entry.')) }
      }
    })
  }, input)
}
