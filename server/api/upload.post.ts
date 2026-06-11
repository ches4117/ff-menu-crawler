import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { readMultipartFormData } from 'h3'
import { loadDotEnv } from '../utils/env'
import { parseImagesWithGemini } from '../utils/gemini'
import { mergeBooth, readBooths } from '../utils/catalog'
import { inputDir, outputCsvPath, outputJsonPath, reviewedCsvPath, reviewedJsonPath } from '../utils/paths'
import { writeOutputs } from '../utils/exporter'
import { findBoothImages } from '../utils/images'

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

  const boothId = sanitizeBoothId(String(form.find(part => part.name === 'boothId')?.data || ''))
  if (!boothId) {
    throw createError({ statusCode: 400, statusMessage: 'Booth ID is required' })
  }

  const files = form.filter(part => part.name === 'images' && part.filename && part.data?.length)
  if (!files.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one image is required' })
  }

  const boothDir = join(inputDir, boothId)
  mkdirSync(boothDir, { recursive: true })

  const saved = files.map((file, index) => {
    const extension = resolveExtension(file.filename || '', file.type || '')
    if (!extension) {
      throw createError({ statusCode: 400, statusMessage: `Unsupported image type: ${file.filename}` })
    }

    const filename = `${Date.now()}-${index + 1}${extension}`
    const path = join(boothDir, filename)
    writeFileSync(path, file.data)
    return relative(process.cwd(), path)
  })

  const imagePaths = findBoothImages(boothDir)
  const sourcePath = imagePaths.map(path => relative(process.cwd(), path)).join(';')
  const booth = await parseImagesWithGemini(imagePaths, boothId, sourcePath, apiKey, model)

  const rawBooths = mergeBooth(readBooths(outputJsonPath), booth)
  writeOutputs(rawBooths, outputJsonPath, outputCsvPath)

  if (existsSync(reviewedJsonPath)) {
    const reviewedBooths = mergeBooth(readBooths(reviewedJsonPath), booth)
    writeOutputs(reviewedBooths, reviewedJsonPath, reviewedCsvPath)
  }

  return {
    ok: true,
    booth_id: boothId,
    files: saved,
    parsed: {
      items: booth.items.length,
      needs_review: booth.needs_review,
      review_reasons: booth.review_reasons,
      cost: booth.cost_estimate?.estimated_total_cost_usd || 0
    },
    booth
  }
})

function sanitizeBoothId (value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
}

function resolveExtension (filename: string, mimeType: string) {
  const extension = extname(filename).toLowerCase()
  if (imageExtensions.has(extension)) return extension
  return mimeExtensions[mimeType] || ''
}
