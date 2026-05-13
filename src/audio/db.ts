import { openDB } from 'idb'
import type { Preset } from '@/presets/factoryPresets'

const DB_NAME    = 'soundlab'
const DB_VERSION = 1

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(database) {
    if (!database.objectStoreNames.contains('user-presets')) {
      database.createObjectStore('user-presets', { keyPath: 'id' })
    }
  },
})

export async function getUserPresets(): Promise<Preset[]> {
  return (await dbPromise).getAll('user-presets')
}

export async function putUserPreset(preset: Preset): Promise<void> {
  await (await dbPromise).put('user-presets', preset)
}

export async function removeUserPreset(id: string): Promise<void> {
  await (await dbPromise).delete('user-presets', id)
}
