import { existsSync, readFileSync } from 'node:fs'
import type { BoothCatalog, BoothItem, CostEstimate } from '../../shared/types'
import { circleCatalogId } from './circleId'

const unknownValues = new Set(['UNKNOWN', 'N/A', 'NA', '-', '?', '不明', '未知', '無法辨識'])
const singleVariantLabels = new Set(['單款', '一款', '單入', '一入', '單張', '一張', '單個', '一個'])
const setVariantLabels = new Set(['一組', '套組', '全套', '大全套', '組合包', '套裝', '福袋', 'SET'])
const variantPattern = '(單款|一款|單入|一入|單張|一張|單個|一個|一組|套組|全套|大全套|組合包|套裝|福袋|SET)'

export function readBooths (path: string): BoothCatalog[] {
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  if (!text.trim()) return []
  return JSON.parse(text)
}

export function mergeBooth (booths: BoothCatalog[], booth: BoothCatalog) {
  const nextBooth = normalizeBoothId(booth)
  const index = booths.findIndex(existing => normalizeBoothId(existing).booth_id === nextBooth.booth_id)
  if (index >= 0) {
    booths[index] = nextBooth
  } else {
    booths.push(nextBooth)
  }
  return booths.sort((a, b) => a.booth_id.localeCompare(b.booth_id))
}

export function normalizeBoothList (booths: BoothCatalog[]) {
  return booths.reduce<BoothCatalog[]>((merged, booth) => {
    const normalized = normalizeBoothId(booth)
    const index = merged.findIndex(existing => existing.booth_id === normalized.booth_id)
    if (index >= 0) {
      merged[index] = combineBooths(merged[index], normalized)
    } else {
      merged.push(normalized)
    }
    return merged
  }, []).sort((a, b) => a.booth_id.localeCompare(b.booth_id))
}

export function normalizeBoothId (booth: BoothCatalog): BoothCatalog {
  return {
    ...booth,
    booth_id: circleCatalogId(booth.circle_name, booth.booth_id),
    day: normalizeDayText(booth.day),
    items: mergeItems([], booth.items)
  }
}

export function combineBooths (left: BoothCatalog, right: BoothCatalog): BoothCatalog {
  return {
    ...left,
    event_name: left.event_name !== 'FF' ? left.event_name : right.event_name,
    booth_id: circleCatalogId(left.circle_name || right.circle_name, right.booth_id),
    circle_name: left.circle_name || right.circle_name,
    day: mergeDayText(left.day, right.day),
    items: mergeItems(left.items, right.items),
    confidence: Math.min(left.confidence, right.confidence),
    needs_review: left.needs_review || right.needs_review,
    review_reasons: [...new Set([...left.review_reasons, ...right.review_reasons])].sort(),
    source_path: mergeText(left.source_path, right.source_path),
    usage_metadata: {
      parts: [left.usage_metadata, right.usage_metadata].filter(Boolean)
    },
    cost_estimate: combineCost(left.cost_estimate, right.cost_estimate)
  }
}

function combineCost (left?: CostEstimate, right?: CostEstimate): CostEstimate | undefined {
  if (!left) return right
  if (!right) return left
  const imageCount = left.image_count + right.image_count
  const totalCost = left.estimated_total_cost_usd + right.estimated_total_cost_usd
  return {
    ...left,
    image_count: imageCount,
    input_tokens: left.input_tokens + right.input_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
    total_tokens: left.total_tokens + right.total_tokens,
    estimated_input_cost_usd: round(left.estimated_input_cost_usd + right.estimated_input_cost_usd),
    estimated_output_cost_usd: round(left.estimated_output_cost_usd + right.estimated_output_cost_usd),
    estimated_total_cost_usd: round(totalCost),
    estimated_cost_per_image_usd: imageCount ? round(totalCost / imageCount) : null
  }
}

function mergeItems (left: BoothItem[], right: BoothItem[]) {
  const merged = new Map<string, BoothItem>()
  for (const item of [...left, ...right]) {
    const key = itemMergeKey(item.title)
    if (!key) {
      merged.set(`__empty_${merged.size}`, item)
      continue
    }

    const current = merged.get(key)
    merged.set(key, current ? combineItems(current, item) : normalizeItem(item))
  }
  return [...merged.values()]
}

function normalizeItem (item: BoothItem): BoothItem {
  return {
    ...item,
    title: displayItemTitle(item.title, item.title),
    notes: normalizeNotes(item.notes)
  }
}

function combineItems (left: BoothItem, right: BoothItem): BoothItem {
  const priceNotes = mergePriceNotes(left, right)
  return {
    ...left,
    title: displayItemTitle(left.title, right.title),
    item_type: preferText(left.item_type, right.item_type) as BoothItem['item_type'],
    fandom: preferText(left.fandom, right.fandom),
    price_twd: mergeItemPrice(left.price_twd, right.price_twd),
    age_rating: preferText(left.age_rating, right.age_rating) as BoothItem['age_rating'],
    format: mergeText(left.format, right.format),
    notes: mergeNotes(left.notes, right.notes, priceNotes)
  }
}

function itemMergeKey (value: string) {
  return baseItemTitle(value).replace(/\s+/g, '').toUpperCase()
}

function displayItemTitle (left: string, right: string) {
  const title = baseItemTitle(preferText(left, right))
  return title || preferText(left, right)
}

function baseItemTitle (value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(new RegExp(`[（(]\\s*${variantPattern}\\s*[）)]`, 'gi'), '')
    .replace(new RegExp(`\\s*${variantPattern}$`, 'i'), '')
    .trim()
}

function mergeItemPrice (left: number | null, right: number | null) {
  if (left === right) return left
  return left ?? right
}

function mergePriceNotes (left: BoothItem, right: BoothItem) {
  const options = [priceOption(left), priceOption(right), ...extractPriceOptions(left.notes), ...extractPriceOptions(right.notes)]
    .map(normalizePriceOption)
    .filter(Boolean)
  const unique = [...new Set(options)]
  return unique.length > 1 ? `價格：${unique.join('；')}` : unique[0] ? `價格：${unique[0]}` : ''
}

function priceOption (item: BoothItem) {
  if (item.price_twd === null) return ''
  const label = itemVariantLabel(item.title)
  return `${label ? `${label} ` : ''}${item.price_twd}`
}

function itemVariantLabel (title: string) {
  const text = title.normalize('NFKC').trim()
  const bracket = text.match(new RegExp(`[（(]\\s*${variantPattern}\\s*[）)]`, 'i'))
  if (bracket?.[1]) return normalizeVariantLabel(bracket[1])

  const suffix = text.match(new RegExp(`${variantPattern}$`, 'i'))
  return suffix?.[1] ? normalizeVariantLabel(suffix[1]) : ''
}

function normalizeVariantLabel (value: string) {
  const text = value.normalize('NFKC').trim()
  const upper = text.toUpperCase()
  if (singleVariantLabels.has(text)) return '單款'
  if (upper === 'SET') return '套組'
  return setVariantLabels.has(text) ? text : text
}

function mergeNotes (...values: string[]) {
  const priceOptions: string[] = []
  const normalNotes: string[] = []

  for (const value of values) {
    for (const part of splitNoteParts(value)) {
      const extracted = extractPriceOptions(part)
      if (extracted.length) {
        priceOptions.push(...extracted)
      } else {
        normalNotes.push(part)
      }
    }
  }

  const normalizedPriceOptions = [...new Set(priceOptions.map(normalizePriceOption).filter(Boolean))]
  const priceNote = normalizedPriceOptions.length ? `價格：${normalizedPriceOptions.join('；')}` : ''
  return mergeText(...[...normalNotes, priceNote])
}

function normalizeNotes (value: string) {
  return mergeNotes(value)
}

function extractPriceOptions (value: string) {
  const text = value.normalize('NFKC').replace(/NTD|TWD|元/g, '').trim()
  const withoutPrefix = text.replace(/^價格[:：]\s*/i, '')
  if (!/\d/.test(withoutPrefix)) return []

  const parts = withoutPrefix
    .split(/[;；,，、]/)
    .map(part => part.trim())
    .filter(Boolean)

  if (!parts.length) return []
  const options = parts.filter(part => /^\D{0,8}\s*\d+$/.test(part) || new RegExp(`^${variantPattern}\\s*\\d+$`, 'i').test(part))
  return options.length ? options : []
}

function normalizePriceOption (value: string) {
  const text = value.normalize('NFKC').replace(/^價格[:：]\s*/i, '').replace(/NTD|TWD|元/g, '').trim()
  const match = text.match(new RegExp(`^(${variantPattern})?\\s*(\\d+)$`, 'i'))
  if (!match) return text
  const label = match[1] ? normalizeVariantLabel(match[1]) : ''
  return `${label ? `${label} ` : ''}${match[2]}`
}

function preferText (left: string, right: string) {
  if (hasUsefulText(left)) return left
  return right
}

function hasUsefulText (value: string) {
  const text = value.normalize('NFKC').trim()
  return Boolean(text) && !unknownValues.has(text.toUpperCase())
}

function mergeDayText (left: string, right: string) {
  const normalized = normalizeDayText(mergeText(left, right))
  return normalized || mergeText(left, right)
}

function normalizeDayText (value: string) {
  const text = value.normalize('NFKC').trim()
  if (!hasUsefulText(text)) return text

  const days = new Set<string>()
  for (const match of text.matchAll(/\bDAY\s*([12])\b/gi)) {
    days.add(`day${match[1]}`)
  }
  for (const match of text.matchAll(/\bD\s*([12])\b/gi)) {
    days.add(`day${match[1]}`)
  }
  if (/第一天|第1天|1日目|一日目/i.test(text)) days.add('day1')
  if (/第二天|第2天|2日目|二日目/i.test(text)) days.add('day2')
  if (/兩天|双日|雙日|兩日|両日|全日/i.test(text)) {
    days.add('day1')
    days.add('day2')
  }

  const ordered = ['day1', 'day2'].filter(day => days.has(day))
  return ordered.length ? ordered.join(', ') : text
}

function mergeText (...values: string[]) {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const part of values.flatMap(splitNoteParts)) {
    const key = part.normalize('NFKC').replace(/\s+/g, '').toUpperCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(part)
  }
  return merged.join(';')
}

function splitNoteParts (value: string) {
  return String(value || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
}

function round (value: number) {
  return Number(value.toFixed(8))
}
