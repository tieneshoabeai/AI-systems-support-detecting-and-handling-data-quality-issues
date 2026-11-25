import { useContext, useSyncExternalStore } from 'react'
import { AuthContext } from '../auth/auth-context'
import type { OfflineStatus } from '../../types/offline/offline.types'
import type { OfflineWriteStatus } from '../../types/offline/offline-write.types'

const online: OfflineStatus = Object.freeze({ offline: false, savedAt: null, storageError: null })
const snapshot = () => online
const subscribe = () => () => {}
export const useLocalData = () => useContext(AuthContext)?.localData
export function useOfflineStatus() {
  const local = useLocalData()
  return useSyncExternalStore(local?.offline.subscribe ?? subscribe, local?.offline.getSnapshot ?? snapshot, snapshot)
}
const noWrites: OfflineWriteStatus = Object.freeze({ entries: [], syncing: false, revision: 0, error: null })
const writeSnapshot = () => noWrites
export function useOfflineWrites() {
  const local = useLocalData()
  return useSyncExternalStore(local?.writes?.subscribe ?? subscribe, local?.writes?.getSnapshot ?? writeSnapshot, writeSnapshot)
}
