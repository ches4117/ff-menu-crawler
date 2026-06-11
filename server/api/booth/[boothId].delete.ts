import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { readBooths } from '../../utils/catalog'
import { inputDir, outputCsvPath, outputJsonPath, reviewedCsvPath, reviewedJsonPath } from '../../utils/paths'
import { writeOutputs } from '../../utils/exporter'

export default defineEventHandler((event) => {
  const boothId = sanitizeBoothId(String(getRouterParam(event, 'boothId') || ''))
  if (!boothId) {
    throw createError({ statusCode: 400, statusMessage: 'Booth ID is required' })
  }

  const boothDir = resolve(inputDir, boothId)
  if (boothDir.startsWith(inputDir) && existsSync(boothDir)) {
    rmSync(boothDir, { recursive: true, force: true })
  }

  const rawBooths = readBooths(outputJsonPath).filter(booth => booth.booth_id !== boothId)
  writeOutputs(rawBooths, outputJsonPath, outputCsvPath)

  if (existsSync(reviewedJsonPath)) {
    const reviewedBooths = readBooths(reviewedJsonPath).filter(booth => booth.booth_id !== boothId)
    writeOutputs(reviewedBooths, reviewedJsonPath, reviewedCsvPath)
  }

  return {
    ok: true,
    booth_id: boothId
  }
})

function sanitizeBoothId (value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
}
