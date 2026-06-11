import { existsSync, readFileSync } from 'node:fs'
import type { BoothCatalog } from '../../shared/types'

export function readBooths (path: string): BoothCatalog[] {
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  if (!text.trim()) return []
  return JSON.parse(text)
}

export function mergeBooth (booths: BoothCatalog[], booth: BoothCatalog) {
  const index = booths.findIndex(existing => existing.booth_id === booth.booth_id)
  if (index >= 0) {
    booths[index] = booth
  } else {
    booths.push(booth)
  }
  return booths.sort((a, b) => a.booth_id.localeCompare(b.booth_id))
}
