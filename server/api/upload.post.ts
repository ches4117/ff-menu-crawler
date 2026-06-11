import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { readMultipartFormData } from 'h3'
import type { BoothCatalog } from '../../shared/types'
import { loadDotEnv } from '../utils/env'
import { parseImagesWithGemini } from '../utils/gemini'
import { combineBooths, mergeBooth, readBooths } from '../utils/catalog'
import { inputDir, outputCsvPath, outputJsonPath, reviewedCsvPath, reviewedJsonPath } from '../utils/paths'
import { writeOutputs } from '../utils/exporter'
import { circleCatalogId, safeStorageId } from '../utils/circleId'

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const mimeExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

export default defineEventHandler(async (event) => {
  loadDotEnv()

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'
  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'GEMINI_API_KEY is not set in .env' })
  }

  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throw createError({ statusCode: 400, statusMessage: 'No upload data received' })
  }

  const files = form.filter(part => part.name === 'images' && part.filename && part.data?.length)
  if (!files.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one image is required' })
  }

  const uploadId = `UPLOAD_${Date.now()}`
  const tempDir = join(inputDir, '_pending', uploadId)
  mkdirSync(tempDir, { recursive: true })

  const saved = files.map((file, index) => {
    const extension = resolveExtension(file.filename || '', file.type || '')
    if (!extension) {
      throw createError({ statusCode: 400, statusMessage: `Unsupported image type: ${file.filename}` })
    }

    const filename = `${Date.now()}-${index + 1}${extension}`
    const path = join(tempDir, filename)
    writeFileSync(path, file.data)
    return path
  })

  const parsedByBooth = new Map<string, BoothCatalog>()
  const finalPathsByBooth = new Map<string, string[]>()

  for (const [index, path] of saved.entries()) {
    const fallbackBoothId = `${uploadId}_${index + 1}`
    const tempSourcePath = relative(process.cwd(), path)
    const parsed = await parseImagesWithGemini([path], fallbackBoothId, tempSourcePath, apiKey, model)
    const boothId = circleCatalogId(parsed.circle_name, parsed.booth_id || fallbackBoothId) || fallbackBoothId
    parsed.booth_id = boothId

    const boothDir = join(inputDir, safeStorageId(boothId))
    mkdirSync(boothDir, { recursive: true })

    const finalPath = join(boothDir, `${Date.now()}-${index + 1}${extname(path).toLowerCase()}`)
    renameSync(path, finalPath)

    const relativeFinalPath = relative(process.cwd(), finalPath)
    parsed.source_path = relativeFinalPath
    finalPathsByBooth.set(boothId, [...(finalPathsByBooth.get(boothId) || []), relativeFinalPath])

    const current = parsedByBooth.get(boothId)
    parsedByBooth.set(boothId, current ? combineBooths(current, parsed) : parsed)
  }

  cleanupPendingDir(tempDir)

  const parsedBooths = [...parsedByBooth.values()].map(booth => ({
    ...booth,
    source_path: (finalPathsByBooth.get(booth.booth_id) || []).join(';')
  }))

  let rawBooths = readBooths(outputJsonPath)
  for (const booth of parsedBooths) {
    rawBooths = mergeBooth(rawBooths, booth)
  }
  writeOutputs(rawBooths, outputJsonPath, outputCsvPath)

  if (existsSync(reviewedJsonPath)) {
    let reviewedBooths = readBooths(reviewedJsonPath)
    for (const booth of parsedBooths) {
      reviewedBooths = mergeBooth(reviewedBooths, booth)
    }
    writeOutputs(reviewedBooths, reviewedJsonPath, reviewedCsvPath)
  }

  return {
    ok: true,
    booth_ids: parsedBooths.map(booth => booth.booth_id),
    files: [...finalPathsByBooth.values()].flat(),
    parsed: {
      booths: parsedBooths.length,
      items: parsedBooths.reduce((sum, booth) => sum + booth.items.length, 0),
      cost: parsedBooths.reduce((sum, booth) => sum + (booth.cost_estimate?.estimated_total_cost_usd || 0), 0)
    },
    booths: parsedBooths
  }
})

function resolveExtension (filename: string, mimeType: string) {
  const extension = extname(filename).toLowerCase()
  if (imageExtensions.has(extension)) return extension
  return mimeExtensions[mimeType] || ''
}

function cleanupPendingDir (tempDir: string) {
  const pendingRoot = resolve(inputDir, '_pending')
  const resolved = resolve(tempDir)
  if (resolved.startsWith(pendingRoot) && existsSync(resolved)) {
    rmSync(resolved, { recursive: true, force: true })
  }
}
