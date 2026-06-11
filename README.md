# FF AI Nuxt 品書整理工具

這個專案把台灣 Fancy Frontier / FF 攤位品書圖片整理成統一格式。

目前版本是 **Nuxt + Vue** 全端 app：

- 讀取 `work/input/<攤位號>/*.jpg|*.jpeg|*.png|*.webp`
- 使用 Gemini 解析圖片內容
- 匯出 `outputs/ff_items.json` 與 `outputs/ff_items.csv`
- 提供 Vue 審核介面，可修改攤位與商品欄位
- 提供圖片上傳功能，輸入攤位號後會存到 `work/input/<攤位號>/`
- 儲存審核結果到 `outputs/ff_items.reviewed.json` 與 `outputs/ff_items.reviewed.csv`
- 顯示 Gemini token 用量與估算成本

## 快速開始

1. 把圖片放到攤位資料夾：

```text
work/input/O12/menu.jpg
work/input/U05/menu.webp
```

2. 在 `.env` 設定 Gemini：

```text
GEMINI_API_KEY=你的-gemini-api-key
GEMINI_MODEL=gemini-3-flash-preview
```

3. 啟動 Nuxt app：

```powershell
.\run_nuxt.bat
```

4. 打開：

```text
http://127.0.0.1:4178
```

## 使用流程

1. 首頁會讀取既有輸出：
   - 優先讀 `outputs/ff_items.reviewed.json`
   - 如果 reviewed 檔不存在或看起來像亂碼，改讀 `outputs/ff_items.json`

2. 上傳圖片：
   - 輸入攤位號
   - 選擇一張或多張圖片
   - 按「上傳」
   - 檔案會存到 `work/input/<攤位號>/`
   - 上傳後會自動解析該攤位
   - 如果輸出裡已經有同攤位，會用新解析結果更新該攤位商品
   - 不會檢查是否重複上傳同一張圖片

3. 按「重新解析圖片」：
   - Nuxt server 掃描 `work/input/`
   - 同一攤位資料夾內的圖片會合併解析
   - 呼叫 Gemini API
   - 輸出 `outputs/ff_items.json` 與 `outputs/ff_items.csv`

4. 在頁面右側審核資料：
   - 修改攤位名稱、日期、社團名
   - 修改商品名稱、分類、價格、年齡分級、格式、備註
   - 新增或刪除商品

5. 按「儲存審核結果」：
   - 輸出 `outputs/ff_items.reviewed.json`
   - 輸出 `outputs/ff_items.reviewed.csv`

## 主要檔案

- `app/pages/index.vue`: Vue 審核介面
- `server/api/process.post.ts`: Gemini 圖片解析 API
- `server/api/upload.post.ts`: 圖片上傳 API
- `server/api/data.get.ts`: 讀取目前資料
- `server/api/save.post.ts`: 儲存 reviewed 結果
- `server/api/source.get.ts`: 顯示原始圖片
- `server/utils/gemini.ts`: Gemini 呼叫與圖片 base64 處理
- `server/utils/schema.ts`: 統一輸出格式與驗證
- `server/utils/exporter.ts`: JSON / CSV 匯出
- `server/utils/cost.ts`: token 與成本估算

## 輸出欄位

每個攤位：

- `event_name`
- `booth_id`
- `circle_name`
- `day`
- `items`
- `source_path`
- `confidence`
- `needs_review`
- `review_reasons`
- `usage_metadata`
- `cost_estimate`

每個商品：

- `title`
- `item_type`
- `fandom`
- `price_twd`
- `age_rating`
- `format`
- `notes`
