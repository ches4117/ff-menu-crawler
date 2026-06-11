import { readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

export const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])

export function findBoothImages (absoluteDir: string) {
  return readdirSync(absoluteDir)
    .filter(name => imageExtensions.has(extname(name).toLowerCase()))
    .sort()
    .map(name => join(absoluteDir, name))
}
