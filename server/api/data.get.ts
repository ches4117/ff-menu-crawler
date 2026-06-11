import { existsSync, readFileSync } from 'node:fs'
import { setHeader } from 'h3'
import { outputJsonPath, reviewedJsonPath } from '../utils/paths'

export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const reviewed = readJsonIfUsable(reviewedJsonPath)
  if (reviewed) return reviewed

  const parsed = readJsonIfUsable(outputJsonPath)
  return parsed || []
})

function readJsonIfUsable (path: string) {
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8')
  if (looksLikeMojibake(text)) return null
  return JSON.parse(text)
}

function looksLikeMojibake (text: string) {
  return /Ã.|Â.|æ.|ç.|å.|è.|é./.test(text)
}
