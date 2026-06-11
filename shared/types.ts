export type ItemType = '新刊' | '既刊' | '周邊' | '套組' | '委託' | '未知'
export type AgeRating = '全年齡' | 'R18' | '未知'

export interface BoothItem {
  title: string
  item_type: ItemType
  fandom: string
  price_twd: number | null
  age_rating: AgeRating
  format: string
  notes: string
}

export interface CostEstimate {
  provider: string
  model: string
  image_count: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_usd_per_1m_tokens: number
  output_usd_per_1m_tokens: number
  estimated_input_cost_usd: number
  estimated_output_cost_usd: number
  estimated_total_cost_usd: number
  estimated_cost_per_image_usd: number | null
}

export interface BoothCatalog {
  event_name: string
  booth_id: string
  circle_name: string
  day: string
  items: BoothItem[]
  confidence: number
  needs_review: boolean
  review_reasons: string[]
  source_path: string
  usage_metadata?: Record<string, unknown>
  cost_estimate?: CostEstimate
}
