export interface GeminiUsage {
  promptTokenCount?: number
  candidatesTokenCount?: number
  thoughtsTokenCount?: number
  totalTokenCount?: number
}

const pricing = {
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 }
}

export function estimateGeminiCost (model: string, usage: GeminiUsage, imageCount: number) {
  const rate = resolvePricing(model)
  const inputTokens = Number(usage.promptTokenCount || 0)
  const candidateTokens = Number(usage.candidatesTokenCount || 0)
  const thoughtsTokens = Number(usage.thoughtsTokenCount || 0)
  const totalTokens = Number(usage.totalTokenCount || 0)
  const outputTokens = Math.max(candidateTokens + thoughtsTokens, totalTokens - inputTokens, 0)
  const inputCost = inputTokens * rate.input / 1_000_000
  const outputCost = outputTokens * rate.output / 1_000_000
  const totalCost = inputCost + outputCost

  return {
    provider: 'gemini',
    model,
    image_count: imageCount,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    input_usd_per_1m_tokens: rate.input,
    output_usd_per_1m_tokens: rate.output,
    estimated_input_cost_usd: round(inputCost),
    estimated_output_cost_usd: round(outputCost),
    estimated_total_cost_usd: round(totalCost),
    estimated_cost_per_image_usd: imageCount ? round(totalCost / imageCount) : null
  }
}

function resolvePricing (model: string) {
  if (model.includes('gemini-3-flash')) return pricing['gemini-3-flash-preview']
  if (model.includes('flash-lite')) return pricing['gemini-2.5-flash-lite']
  return pricing['gemini-2.5-flash']
}

function round (value: number) {
  return Number(value.toFixed(8))
}
