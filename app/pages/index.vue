<script setup lang="ts">
import type { BoothCatalog, BoothItem } from '~/shared/types'

const itemTypes = ['新刊', '既刊', '周邊', '套組', '委託', '未知']
const ageRatings = ['全年齡', 'R18', '未知']

const booths = ref<BoothCatalog[]>([])
const active = ref(0)
const pending = ref(false)
const savePending = ref(false)
const uploadPending = ref(false)
const uploadBoothId = ref('')
const uploadInput = ref<HTMLInputElement | null>(null)
const status = ref('載入中...')
const statusKind = ref('')

const activeBooth = computed(() => booths.value[active.value])
const sourceImages = computed(() => String(activeBooth.value?.source_path || '').split(';').filter(Boolean))
const totalItems = computed(() => booths.value.reduce((sum, booth) => sum + booth.items.length, 0))
const totalCost = computed(() => booths.value.reduce((sum, booth) => sum + (booth.cost_estimate?.estimated_total_cost_usd || 0), 0))

onMounted(loadData)

async function loadData () {
  booths.value = await $fetch<BoothCatalog[]>('/api/data')
  status.value = booths.value.length ? `已載入 ${booths.value.length} 個攤位` : '尚未產生輸出，請先按重新解析'
  statusKind.value = booths.value.length ? 'ok' : 'warn'
}

async function processImages () {
  pending.value = true
  status.value = 'Gemini 解析中...'
  statusKind.value = ''
  try {
    const result = await $fetch<{ booths: number, items: number, cost: number }>('/api/process', { method: 'POST' })
    await loadData()
    status.value = `解析完成：${result.booths} 攤、${result.items} 商品、估算 US$${result.cost.toFixed(8)}`
    statusKind.value = 'ok'
  } catch (error: any) {
    status.value = error?.data?.statusMessage || error?.message || '解析失敗'
    statusKind.value = 'warn'
  } finally {
    pending.value = false
  }
}

async function saveReviewed () {
  savePending.value = true
  status.value = '儲存中...'
  statusKind.value = ''
  try {
    await $fetch('/api/save', { method: 'POST', body: { booths: booths.value } })
    status.value = '已儲存 reviewed JSON/CSV'
    statusKind.value = 'ok'
  } catch (error: any) {
    status.value = error?.data?.statusMessage || error?.message || '儲存失敗'
    statusKind.value = 'warn'
  } finally {
    savePending.value = false
  }
}

async function uploadImages () {
  const files = uploadInput.value?.files
  if (!uploadBoothId.value.trim() || !files?.length) {
    status.value = '請輸入攤位號並選擇圖片'
    statusKind.value = 'warn'
    return
  }

  uploadPending.value = true
  status.value = '上傳中...'
  statusKind.value = ''
  try {
    const form = new FormData()
    form.append('boothId', uploadBoothId.value)
    Array.from(files).forEach(file => form.append('images', file))

    const result = await $fetch<{ booth_id: string, files: string[], parsed: { items: number, cost: number } }>('/api/upload', {
      method: 'POST',
      body: form
    })

    uploadBoothId.value = result.booth_id
    if (uploadInput.value) uploadInput.value.value = ''
    await loadData()
    const boothIndex = booths.value.findIndex(booth => booth.booth_id === result.booth_id)
    if (boothIndex >= 0) active.value = boothIndex
    status.value = `已上傳 ${result.files.length} 張並解析 ${result.parsed.items} 個商品，估算 US$${result.parsed.cost.toFixed(8)}`
    statusKind.value = 'ok'
  } catch (error: any) {
    status.value = error?.data?.statusMessage || error?.message || '上傳失敗'
    statusKind.value = 'warn'
  } finally {
    uploadPending.value = false
  }
}

function addItem () {
  if (!activeBooth.value) return
  activeBooth.value.items.push({
    title: '未知',
    item_type: '未知',
    fandom: '未知',
    price_twd: null,
    age_rating: '未知',
    format: '未知',
    notes: ''
  })
}

function removeItem (index: number) {
  activeBooth.value?.items.splice(index, 1)
}

function imageUrl (path: string) {
  return `/api/source?path=${encodeURIComponent(path)}`
}

function itemPrice (item: BoothItem) {
  return item.price_twd ?? ''
}

function updateItemPrice (item: BoothItem, value: string) {
  item.price_twd = value === '' ? null : Number(value)
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <h1>FF AI Review</h1>
        <p>{{ booths.length }} 攤 · {{ totalItems }} 商品 · US${{ totalCost.toFixed(8) }}</p>
      </div>
      <div class="toolbar">
        <span class="status" :class="statusKind">{{ status }}</span>
        <button :disabled="pending" @click="processImages">重新解析圖片</button>
        <button :disabled="!activeBooth" @click="addItem">新增商品</button>
        <button class="primary" :disabled="savePending || !booths.length" @click="saveReviewed">儲存審核結果</button>
      </div>
    </header>

    <main class="workspace">
      <aside class="booth-list">
        <form class="upload-panel" @submit.prevent="uploadImages">
          <div class="panel-title">上傳圖片</div>
          <label>攤位號
            <input v-model="uploadBoothId" placeholder="例如 O12" autocomplete="off">
          </label>
          <label>圖片
            <input ref="uploadInput" type="file" accept="image/jpeg,image/png,image/webp" multiple>
          </label>
          <button class="primary" :disabled="uploadPending" type="submit">上傳</button>
        </form>

        <button
          v-for="(booth, index) in booths"
          :key="`${booth.booth_id}-${index}`"
          class="booth-tab"
          :class="{ active: index === active }"
          @click="active = index"
        >
          <span>
            <strong>{{ booth.booth_id }}</strong>
            <small>{{ booth.circle_name }} · {{ booth.items.length }} items</small>
          </span>
          <span class="badge" :class="{ warn: booth.needs_review }">
            {{ booth.needs_review ? 'review' : 'ok' }}
          </span>
        </button>
      </aside>

      <section class="image-pane">
        <img v-for="path in sourceImages" :key="path" class="source-image" :src="imageUrl(path)" :alt="path">
      </section>

      <section v-if="activeBooth" class="editor-pane">
        <div class="panel">
          <div class="panel-title">攤位資料</div>
          <div class="form-grid">
            <label>活動<input v-model="activeBooth.event_name"></label>
            <label>攤位<input v-model="activeBooth.booth_id"></label>
            <label>社團<input v-model="activeBooth.circle_name"></label>
            <label>日期<input v-model="activeBooth.day"></label>
            <label>信心<input v-model.number="activeBooth.confidence" type="number" min="0" max="1" step="0.01"></label>
            <label>需審核
              <select v-model="activeBooth.needs_review">
                <option :value="false">否</option>
                <option :value="true">是</option>
              </select>
            </label>
          </div>
          <label class="full">審核原因
            <textarea
              :value="activeBooth.review_reasons.join('\n')"
              @input="activeBooth.review_reasons = ($event.target as HTMLTextAreaElement).value.split('\n').map(v => v.trim()).filter(Boolean)"
            />
          </label>
        </div>

        <div class="panel">
          <div class="panel-title">商品</div>
          <div v-for="(item, index) in activeBooth.items" :key="index" class="item-editor">
            <div class="item-head">
              <strong>商品 {{ index + 1 }}</strong>
              <button @click="removeItem(index)">刪除</button>
            </div>
            <div class="form-grid">
              <label>品名<input v-model="item.title"></label>
              <label>類型
                <select v-model="item.item_type">
                  <option v-for="type in itemTypes" :key="type">{{ type }}</option>
                </select>
              </label>
              <label>作品<input v-model="item.fandom"></label>
              <label>價格<input :value="itemPrice(item)" type="number" @input="updateItemPrice(item, ($event.target as HTMLInputElement).value)"></label>
              <label>年齡
                <select v-model="item.age_rating">
                  <option v-for="rating in ageRatings" :key="rating">{{ rating }}</option>
                </select>
              </label>
              <label>格式<input v-model="item.format"></label>
            </div>
            <label class="full">備註<textarea v-model="item.notes" /></label>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; }
.topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; padding: 10px 18px; border-bottom: 1px solid var(--line); background: var(--panel); }
h1 { margin: 0; font-size: 18px; }
p { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
.toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.status { color: var(--muted); font-size: 13px; }
.status.ok { color: var(--ok); }
.status.warn { color: var(--warn); }
.workspace { display: grid; grid-template-columns: 260px minmax(360px, 1fr) minmax(540px, 1.15fr); min-height: calc(100vh - 64px); }
.booth-list { max-height: calc(100vh - 64px); overflow: auto; border-right: 1px solid var(--line); background: var(--panel); }
.upload-panel { display: grid; gap: 10px; padding: 14px; border-bottom: 1px solid var(--line); background: #fbfcfd; }
.booth-tab { display: grid; grid-template-columns: 1fr auto; width: 100%; gap: 8px; align-items: center; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; padding: 12px 14px; text-align: left; }
.booth-tab.active { background: var(--accent-soft); }
.booth-tab small { display: block; margin-top: 3px; color: var(--muted); }
.badge { display: inline-flex; align-items: center; min-height: 22px; padding: 2px 8px; border-radius: 999px; background: #eef2f6; color: var(--muted); font-size: 12px; }
.badge.warn { background: #fff4e5; color: var(--warn); }
.image-pane { display: grid; align-content: start; gap: 14px; max-height: calc(100vh - 64px); overflow: auto; padding: 16px; border-right: 1px solid var(--line); }
.source-image { display: block; width: 100%; border: 1px solid var(--line); border-radius: 8px; background: white; }
.editor-pane { max-height: calc(100vh - 64px); overflow: auto; padding: 16px; }
.panel { margin-bottom: 14px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.panel-title { margin-bottom: 10px; font-size: 14px; font-weight: 650; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
label { display: grid; gap: 4px; color: var(--muted); font-size: 12px; }
.full { margin-top: 10px; }
.item-editor { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.item-editor:first-of-type { margin-top: 0; padding-top: 0; border-top: 0; }
.item-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
@media (max-width: 1180px) { .workspace { grid-template-columns: 220px 1fr; } .editor-pane { grid-column: 1 / -1; max-height: none; } }
</style>
