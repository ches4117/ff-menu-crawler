import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { loadDotEnv } from '../utils/env'
import { inputDir, outputCsvPath, outputJsonPath } from '../utils/paths'
import { parseImagesWithGemini } from '../utils/gemini'
import { writeOutputs } from '../utils/exporter'
import { findBoothImages } from '../utils/images'
import { mergeBooth } from '../utils/catalog'
import type { BoothCatalog } from '../../shared/types'

export default defineEventHandler(async () => {
  loadDotEnv()

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'
  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'GEMINI_API_KEY is not set in .env' })
  }
  if (!existsSync(inputDir)) {
    throw createError({ statusCode: 400, statusMessage: `Input directory not found: ${inputDir}` })
  }

  const boothDirs = readdirSync(inputDir, { withFileTypes: true }).filter(entry => entry.isDirectory())
  let booths: BoothCatalog[] = []

  for (const boothDir of boothDirs) {
    const absoluteDir = join(inputDir, boothDir.name)
    const imagePaths = findBoothImages(absoluteDir)

    if (!imagePaths.length) continue

    const sourcePath = imagePaths.map(path => relative(process.cwd(), path)).join(';')
    const booth = await parseImagesWithGemini(imagePaths, boothDir.name, sourcePath, apiKey, model)
    booths = mergeBooth(booths, booth)
  }

  mkdirSync(dirname(outputJsonPath), { recursive: true })
  writeOutputs(booths, outputJsonPath, outputCsvPath)

  return {
    ok: true,
    model,
    booths: booths.length,
    items: booths.reduce((sum, booth) => sum + booth.items.length, 0),
    needs_review: booths.filter(booth => booth.needs_review).length,
    outputs: {
      json: outputJsonPath,
      csv: outputCsvPath
    },
    cost: booths.reduce((sum, booth) => sum + (booth.cost_estimate?.estimated_total_cost_usd || 0), 0)
  }
})
