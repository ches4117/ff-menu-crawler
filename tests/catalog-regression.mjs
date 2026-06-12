import assert from 'node:assert/strict'
import { test } from 'node:test'

const catalog = await import('../.output/server/chunks/_/catalog.mjs')
const normalizeBoothList = catalog.normalizeBoothList || catalog.n

function booth (overrides = {}) {
  return {
    event_name: 'FF',
    booth_id: 'C25',
    circle_name: '翻渣大叔',
    day: 'DAY1;Day 1, Day 2;DAY1, DAY2',
    items: [],
    confidence: 0.9,
    needs_review: false,
    review_reasons: [],
    source_path: 'work/input/sample/a.jpg',
    ...overrides
  }
}

function item (overrides = {}) {
  return {
    title: '絕區零明信片',
    item_type: '新刊',
    fandom: '絕區零',
    price_twd: 30,
    age_rating: '全年齡',
    format: '',
    notes: '',
    ...overrides
  }
}

test('normalizes duplicated day text', () => {
  const [result] = normalizeBoothList([booth()])
  assert.equal(result.day, 'day1, day2')
})

test('merges title variants into a single item with multi-price note', () => {
  const [result] = normalizeBoothList([
    booth({
      items: [
        item({ title: '絕區零明信片 (單款)', price_twd: 30 }),
        item({ title: '絕區零明信片一組', price_twd: 100 })
      ]
    })
  ])

  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].title, '絕區零明信片')
  assert.equal(result.items[0].price_twd, 30)
  assert.equal(result.items[0].notes, '價格：單款 30；一組 100')
})

test('does not duplicate single price into notes', () => {
  const [result] = normalizeBoothList([
    booth({
      items: [
        item({ title: '絕區零明信片', price_twd: 30, notes: '價格：30' })
      ]
    })
  ])

  assert.equal(result.items[0].price_twd, 30)
  assert.equal(result.items[0].notes, '')
})

test('removes invalid price notes', () => {
  const [result] = normalizeBoothList([
    booth({
      items: [
        item({ title: '絕區零明信片', price_twd: 30, notes: '價格：undefined；單款 單款' })
      ]
    })
  ])

  assert.equal(result.items[0].notes, '')
})

test('keeps set wording when it is part of the product name', () => {
  const [result] = normalizeBoothList([
    booth({
      items: [
        item({ title: '我愛絕區零小套組', item_type: '套組', price_twd: 100 })
      ]
    })
  ])

  assert.equal(result.items[0].title, '我愛絕區零小套組')
})

test('normalizes removed unknown enum values', () => {
  const [result] = normalizeBoothList([
    booth({
      items: [
        item({ item_type: '未知', age_rating: '未知' })
      ]
    })
  ])

  assert.equal(result.items[0].item_type, '新刊')
  assert.equal(result.items[0].age_rating, '全年齡')
})
