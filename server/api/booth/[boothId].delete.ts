import { existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { BoothCatalog } from '../../../shared/types'
import { readBooths } from '../../utils/catalog'
import { circleCatalogId, safeStorageId } from '../../utils/circleId'
import { inputDir, outputCsvPath, outputJsonPath, reviewedCsvPath, reviewedJsonPath } from '../../utils/paths'
import { writeOutputs } from '../../utils/exporter'

export default defineEventHandler((event) => {
  const rawBoothId = String(getRouterParam(event, 'boothId') || '').trim()
  if (!rawBoothId) {
    throw createError({ statusCode: 400, statusMessage: 'Booth ID is required' })
  }

  const rawBooths = readBooths(outputJsonPath)
  const reviewedBooths = existsSync(reviewedJsonPath) ? readBooths(reviewedJsonPath) : []
  const matchedBooths = [...rawBooths, ...reviewedBooths].filter(booth => matchesBooth(booth, rawBoothId))

  removeBoothDir(safeStorageId(rawBoothId))
  removeSourceDirs(matchedBooths)

  const nextRawBooths = rawBooths.filter(booth => !matchesBooth(booth, rawBoothId))
  writeOutputs(nextRawBooths, outputJsonPath, outputCsvPath)

  if (existsSync(reviewedJsonPath)) {
    const nextReviewedBooths = reviewedBooths.filter(booth => !matchesBooth(booth, rawBoothId))
    writeOutputs(nextReviewedBooths, reviewedJsonPath, reviewedCsvPath)
  }

  return {
    ok: true,
    booth_id: rawBoothId,
    removed: matchedBooths.length
  }
})

function matchesBooth (booth: BoothCatalog, rawBoothId: string) {
  return booth.booth_id === rawBoothId || circleCatalogId(booth.circle_name, booth.booth_id) === rawBoothId
}

function removeBoothDir (boothId: string) {
  const boothDir = resolve(inputDir, boothId)
  removeInsideInputDir(boothDir)
}

function removeSourceDirs (booths: BoothCatalog[]) {
  for (const booth of booths) {
    for (const sourcePath of String(booth.source_path || '').split(';').filter(Boolean)) {
      removeInsideInputDir(resolve(process.cwd(), dirname(sourcePath)))
    }
  }
}

function removeInsideInputDir (target: string) {
  const inputRoot = resolve(inputDir)
  if (target.startsWith(inputRoot) && target !== inputRoot && existsSync(target)) {
    rmSync(target, { recursive: true, force: true })
  }
}
