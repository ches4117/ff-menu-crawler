import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import type { BoothCatalog } from '../../shared/types'
import { estimateGeminiCost } from './cost'
import { boothJsonSchema, normalizeBooth } from './schema'

const imageMimes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

export async function parseImagesWithGemini (imagePaths: string[], boothId: string, sourcePath: string, apiKey: string, model: string): Promise<BoothCatalog> {
  const parts: any[] = [{ text: buildPrompt(boothId, sourcePath) }]

  for (const path of imagePaths) {
    parts.push({ text: `圖片檔名：${basename(path)}` })
    parts.push({
      inline_data: {
        mime_type: imageMime(path),
        data: readFileSync(path).toString('base64')
      }
    })
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: boothJsonSchema
    }
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.find((part: any) => typeof part.text === 'string')?.text
  if (!text) throw new Error(`Gemini response did not contain JSON text: ${JSON.stringify(data)}`)

  const booth = normalizeBooth(JSON.parse(text), boothId, sourcePath)
  booth.usage_metadata = data.usageMetadata || {}
  booth.cost_estimate = estimateGeminiCost(model, data.usageMetadata || {}, imagePaths.length)
  return booth
}

function buildPrompt (boothId: string, sourcePath: string) {
  return `你是台灣 Fancy Frontier / FF 同人場攤位品書的 OCR 與資料整理助手。
請從圖片解析攤位資訊與商品清單，輸出符合 schema 的 JSON。

背景資料：
- 活動預設為 FF。
- fallback booth_id: ${boothId}
- source_path: ${sourcePath}

通用規則：
1. 盡量保留原文商品名稱、社團名稱、作品名稱。
2. booth_id 填圖片中辨識到的攤位號碼；circle_name 填社團名稱。
3. price_twd 只填新台幣數字，無法辨識則填 null。
4. R18、成人向、18禁商品請將 age_rating 設為 R18。
5. OCR 不確定、圖片模糊、價格或品名不完整時，needs_review 設為 true 並寫入 review_reasons。
6. 不要自行補不存在於圖片中的商品。

價格與同商品合併規則：
1. 如果同一商品有多種販售方式或價格方案，例如單款、單張、單入、一組、套組、全套，請只輸出一筆商品。
2. title 使用基礎品名，不要包含「單款」「一組」「全套」等販售方式字樣。
3. 如果「套組」是商品名稱的一部分，例如「我愛絕區零小套組」，title 必須保留完整名稱，不要切成「我愛絕區零小」。
4. price_twd 請填單款、單張或單入價格；若沒有單款價格，填圖片中最主要或最小的價格；若完全無法判斷，填 null。
5. notes 只在同一商品有多個價格方案時填寫，格式固定為「價格：單款 30；一組 100」。
6. notes 中不要重複列出相同價格方案。
7. 不要把「一組 100」改寫成「單款 100」；販售方式必須和圖片文字一致。
8. 如果只有一個價格，不要在 notes 重複寫價格，直接填 price_twd 即可。
9. 範例：看到「絕區零明信片 單款30 / 一組100」時，只輸出一筆 title「絕區零明信片」、price_twd 30、notes「價格：單款 30；一組 100」。

套組規則：
1. 如果商品是套組、SET、組合包、全套、大全套、套裝、福袋，或圖片中明確標示一個價格包含多個品項，商品仍以套組本身作為單一商品列出。
2. item_type 請選擇「套組」或最接近的類型。
3. notes 必須列出套組包含的商品，格式建議為「內含：商品A、商品B、商品C」。
4. 如果只能看出部分內容，notes 請寫「內含：已辨識項目；其餘不明」，並把 needs_review 設為 true。
5. 不要因為套組內含多個品項，就把套組拆成多個重複商品。
6. 如果同一張圖中套組和套組內單品都各自有獨立售價，可以同時列出；如果只有套組售價，請只列套組。`
}

function imageMime (path: string) {
  const mime = imageMimes[extname(path).toLowerCase()]
  if (!mime) throw new Error(`Unsupported image type: ${path}`)
  return mime
}
