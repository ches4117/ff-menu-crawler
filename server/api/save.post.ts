import type { BoothCatalog } from '../../shared/types'
import { reviewedCsvPath, reviewedJsonPath } from '../utils/paths'
import { writeOutputs } from '../utils/exporter'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ booths?: BoothCatalog[] }>(event)
  if (!Array.isArray(body.booths)) {
    throw createError({ statusCode: 400, statusMessage: 'Expected booths array' })
  }

  writeOutputs(body.booths, reviewedJsonPath, reviewedCsvPath)
  return {
    ok: true,
    outputs: {
      json: reviewedJsonPath,
      csv: reviewedCsvPath
    }
  }
})
