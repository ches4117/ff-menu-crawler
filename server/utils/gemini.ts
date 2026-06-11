import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import type { BoothCatalog } from '../../shared/types'
import { estimateGeminiCost } from './cost'
import { boothJsonSchema, normalizeBooth } from './schema'

const systemPrompt = `你是台灣同人活動 FF 品書資料整理助手。
請把使用者提供的品書圖片、貼文或 OCR 文字整理成 JSON。

規則：
1. 不確定的欄位填「未知」或 null，不要自行腦補。
2. 同一商品若有不同版本、價格或尺寸，拆成多筆商品。
3. 套組填 item_type「套組」，notes 說明包含內容。
4. 價格只填新台幣整數；免費、未標價、通販價不明時填 null。
5. 成人向、18禁、R-18 都統一成 age_rating「R18」。
6. OCR 文字混亂、缺價格、商品不明、攤位或社團不確定時，needs_review 設 true 並填 review_reasons。
7. 只根據輸入內容整理，不要使用外部知識。`

const imageMimes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

export async function parseImagesWithGemini (imagePaths: string[], boothId: string, sourcePath: string, apiKey: string, model: string): Promise<BoothCatalog> {
  const parts: any[] = [{
    text: `${systemPrompt}\n\n預設活動：FF\n預設攤位號：${boothId}\n來源檔案：${sourcePath}\n\n請閱讀接下來的品書圖片。多張圖片屬於同一攤位時，請合併成同一份商品清單。若圖片中看得到攤位號，booth_id 必須使用圖片中的攤位號；只有完全看不到攤位號時，才使用預設攤位號。`
  }]

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

function imageMime (path: string) {
  const mime = imageMimes[extname(path).toLowerCase()]
  if (!mime) throw new Error(`Unsupported image type: ${path}`)
  return mime
}
