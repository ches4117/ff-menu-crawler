export function normalizeCircleName (value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
}

export function circleCatalogId (circleName: string, fallbackId: string) {
  const normalized = normalizeCircleName(circleName)
  if (normalized && !isUnknownCircleName(normalized)) return normalized
  return fallbackId.trim()
}

export function safeStorageId (value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'UNKNOWN'
}

function isUnknownCircleName (value: string) {
  return ['UNKNOWN', 'N/A', 'NA', '-', '?', '不明', '未知', '無法辨識'].includes(value.toUpperCase())
}
