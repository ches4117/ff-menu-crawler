# FF AI Review

這是一個用 **Nuxt + Vue + Gemini API** 製作的 FF / Fancy Frontier 品書整理工具。

使用者在網頁上傳攤位品書圖片後，系統會自動呼叫 Gemini 解析圖片內容，整理成統一格式，並提供瀏覽器介面讓你檢查、修改、儲存成 JSON / CSV。

## 功能

- 在瀏覽器上傳一張或多張品書圖片。
- 上傳後自動解析，不需要手動輸入攤位號碼。
- 以社團名稱作為資料 ID，避免同一社團因攤位寫法不同被拆成多筆。
- 同時上傳多個社團時，會依解析到的社團名稱分組。
- 同一社團重複上傳時，會更新該社團商品，不檢查圖片是否重複。
- 可移除已上傳社團及其圖片。
- 可在網頁上人工修正解析結果。
- 儲存審核結果後輸出 reviewed JSON / CSV。
- 顯示 Gemini token 使用量與估算費用。

## 目前整理規則

### 社團與日期

- `booth_id` 目前使用社團名稱，而不是攤位號碼。
- 攤位號碼仍會由 Gemini 解析，但主要用於參考，不作為合併主鍵。
- 日期會正規化，例如：
  - `DAY1`
  - `Day 1, Day 2`
  - `DAY1, DAY2`

  會整理成：

  ```text
  day1, day2
  ```

### 商品合併

同一社團內，系統會合併明顯是同一商品的項目，例如：

```text
絕區零明信片
絕區零明信片 (單款)
絕區零明信片一組
```

會整理成一筆：

```text
title: 絕區零明信片
notes: 價格：單款 30；一組 100
```

備註中的重複價格文字也會正規化，例如：

```text
價格：單款 30；一組 100 NTD;價格：單款 30；一組 100NTD;單款 30；一組 100
```

會整理成：

```text
價格：單款 30；一組 100
```

### 套組

如果商品是套組、SET、組合包、全套、大全套、套裝、福袋，或圖片中明確標示一個價格包含多個品項：

- 套組本身會作為單一商品列出。
- `notes` 需要列出套組包含的商品。
- 建議格式：

```text
內含：商品A、商品B、商品C
```

如果只能看出部分內容，會標記需要審核。

## 安裝與啟動

1. 建立 `.env`：

```text
GEMINI_API_KEY=你的 Gemini API key
GEMINI_MODEL=gemini-3-flash-preview
```

2. 啟動服務：

Windows：

```powershell
.\run_nuxt.bat
```

macOS / Linux：

```bash
chmod +x ./run_nuxt.sh
./run_nuxt.sh
```

3. 開啟瀏覽器：

```text
http://127.0.0.1:4178
```

啟動腳本會自動：

- 安裝缺少的 `node_modules`
- 執行 `npm run build`
- 用 `PORT=4178` 啟動 Nuxt server

## 使用流程

1. 開啟 `http://127.0.0.1:4178`。
2. 點選上傳圖片。
3. 選擇一張或多張品書圖片。
4. 系統會自動解析圖片並加入左側社團清單。
5. 點選社團後，在右側檢查攤位資料與商品資料。
6. 必要時人工修改欄位。
7. 點選儲存審核結果。

## 輸出檔案

原始解析結果：

```text
outputs/ff_items.json
outputs/ff_items.csv
```

人工審核後結果：

```text
outputs/ff_items.reviewed.json
outputs/ff_items.reviewed.csv
```

上傳圖片會存放在：

```text
work/input/
```

這些上傳圖片與解析輸出通常不需要 commit。

## 資料欄位

攤位 / 社團資料：

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

商品資料：

- `title`
- `item_type`
- `fandom`
- `price_twd`
- `age_rating`
- `format`
- `notes`

## 主要檔案

- `app/pages/index.vue`：主要 Vue 操作介面。
- `server/api/upload.post.ts`：圖片上傳與自動解析 API。
- `server/api/data.get.ts`：讀取目前資料。
- `server/api/save.post.ts`：儲存審核後資料。
- `server/api/source.get.ts`：讀取上傳圖片。
- `server/api/booth/[boothId].delete.ts`：移除已上傳社團。
- `server/api/process.post.ts`：從 `work/input` 批次重新解析的 API。
- `server/utils/gemini.ts`：Gemini API 呼叫與解析提示詞。
- `server/utils/schema.ts`：Gemini JSON schema 與資料正規化。
- `server/utils/catalog.ts`：社團、日期、商品、備註合併邏輯。
- `server/utils/circleId.ts`：社團 ID 與圖片資料夾名稱正規化。
- `server/utils/exporter.ts`：輸出 JSON / CSV。
- `server/utils/cost.ts`：token 與費用估算。

## 注意事項

- 上傳圖片會呼叫 Gemini API，會產生 token 使用量與費用。
- `.env` 不應 commit。
- `work/input/` 與 `outputs/` 是本機資料與輸出結果，通常應保持在 git ignore 中。
- 若修改了解析提示詞或合併規則，需要重新 build 並重啟服務。
