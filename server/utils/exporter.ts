import { mkdirSync, writeFileSync } from 'node:fs'
import { outputDir } from './paths'
import type { BoothCatalog } from '../../shared/types'

const fields = [
  'event_name',
  'booth_id',
  'circle_name',
  'day',
  'title',
  'item_type',
  'fandom',
  'price_twd',
  'age_rating',
  'format',
  'notes',
  'needs_review',
  'review_reasons',
  'confidence',
  'input_tokens',
  'output_tokens',
  'total_tokens',
  'estimated_total_cost_usd',
  'estimated_cost_per_image_usd',
  'source_path'
]

export function writeOutputs (booths: BoothCatalog[], jsonPath: string, csvPath: string) {
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(jsonPath, JSON.stringify(booths, null, 2), 'utf8')
  writeCsv(booths, csvPath)
}

export function writeCsv (booths: BoothCatalog[], csvPath: string) {
  const rows = [fields.join(',')]

  for (const booth of booths) {
    for (const item of booth.items || []) {
      const estimate = booth.cost_estimate
      rows.push([
        booth.event_name,
        booth.booth_id,
        booth.circle_name,
        booth.day,
        item.title,
        item.item_type,
        item.fandom,
        item.price_twd ?? '',
        item.age_rating,
        item.format,
        item.notes,
        booth.needs_review,
        (booth.review_reasons || []).join('；'),
        booth.confidence,
        estimate?.input_tokens ?? '',
        estimate?.output_tokens ?? '',
        estimate?.total_tokens ?? '',
        estimate?.estimated_total_cost_usd ?? '',
        estimate?.estimated_cost_per_image_usd ?? '',
        booth.source_path
      ].map(csvCell).join(','))
    }
  }

  writeFileSync(csvPath, `\uFEFF${rows.join('\n')}`, 'utf8')
}

function csvCell (value: unknown) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}
