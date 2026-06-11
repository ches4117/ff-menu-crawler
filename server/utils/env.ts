import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadDotEnv () {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return

  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue

    const [rawKey, ...rest] = line.split('=')
    const key = rawKey.trim().replace(/^\uFEFF/, '')
    const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
