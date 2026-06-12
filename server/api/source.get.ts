import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { getQuery, setHeader } from 'h3'
import { inputDir, isInsideDir, rootDir } from '../utils/paths'

const mimes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

export default defineEventHandler((event) => {
  const rawPath = String(getQuery(event).path || '')
  const path = resolve(rootDir, rawPath)
  const mime = mimes[extname(path).toLowerCase()]
  if (!mime || !isInsideDir(inputDir, path) || !existsSync(path)) {
    throw createError({ statusCode: 404, statusMessage: 'Image not found' })
  }

  setHeader(event, 'Content-Type', mime)
  return readFileSync(path)
})
