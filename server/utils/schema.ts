import type { BoothCatalog, BoothItem } from '../../shared/types'

export const itemTypes = ['新刊', '既刊', '周邊', '套組', '委託'] as const
export const ageRatings = ['全年齡', 'R18'] as const

export const boothJsonSchema = {
  type: 'object',
  properties: {
    event_name: { type: 'string' },
    booth_id: { type: 'string' },
    circle_name: { type: 'string' },
    day: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          item_type: { type: 'string', enum: itemTypes },
          fandom: { type: 'string' },
          price_twd: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
          age_rating: { type: 'string', enum: ageRatings },
          format: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['title', 'item_type', 'fandom', 'price_twd', 'age_rating', 'format', 'notes']
      }
    },
    confidence: { type: 'number' },
    needs_review: { type: 'boolean' },
    review_reasons: { type: 'array', items: { type: 'string' } }
  },
  required: ['event_name', 'booth_id', 'circle_name', 'day', 'items', 'confidence', 'needs_review', 'review_reasons']
}

export function normalizeBooth (data: Partial<BoothCatalog>, boothId: string, sourcePath: string): BoothCatalog {
  const booth: BoothCatalog = {
    event_name: clean(data.event_name, 'FF'),
    booth_id: clean(data.booth_id, boothId),
    circle_name: clean(data.circle_name, '未知'),
    day: clean(data.day, 'unknown'),
    items: Array.isArray(data.items) ? data.items.map(normalizeItem) : [],
    confidence: clamp(Number(data.confidence ?? 0.5)),
    needs_review: Boolean(data.needs_review),
    review_reasons: Array.isArray(data.review_reasons) ? data.review_reasons.map(String) : [],
    source_path: sourcePath
  }

  validateBooth(booth)
  return booth
}

function normalizeItem (item: Partial<BoothItem>): BoothItem {
  const itemType = itemTypes.includes(item.item_type as never) ? item.item_type as BoothItem['item_type'] : itemTypes[0]
  const ageRating = ageRatings.includes(item.age_rating as never) ? item.age_rating as BoothItem['age_rating'] : ageRatings[0]
  const price = typeof item.price_twd === 'number' && Number.isFinite(item.price_twd) ? Math.trunc(item.price_twd) : null

  return {
    title: clean(item.title, '未知'),
    item_type: itemType,
    fandom: clean(item.fandom, '未知'),
    price_twd: price,
    age_rating: ageRating,
    format: clean(item.format, '未知'),
    notes: clean(item.notes, '')
  }
}

function validateBooth (booth: BoothCatalog) {
  const reasons = new Set(booth.review_reasons)
  if (!booth.items.length) reasons.add('未解析出任何商品')
  if (booth.circle_name === '未知') reasons.add('社團名稱未知')

  for (const item of booth.items) {
    if (item.title === '未知') reasons.add('商品名稱未知')
    if (item.price_twd === null) reasons.add(`${item.title} 缺少價格`)
    else if (item.price_twd <= 0 || item.price_twd > 5000) reasons.add(`${item.title} 價格可能異常`)
  }

  booth.review_reasons = [...reasons].sort()
  booth.needs_review = booth.review_reasons.length > 0
}

function clean (value: unknown, fallback: string) {
  const text = String(value ?? '').trim()
  return text || fallback
}

function clamp (value: number) {
  if (!Number.isFinite(value)) return 0.5
  return Math.max(0, Math.min(1, value))
}
