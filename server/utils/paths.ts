import { resolve } from 'node:path'

export const rootDir = resolve(process.cwd())
export const inputDir = resolve(rootDir, 'work/input')
export const outputDir = resolve(rootDir, 'outputs')
export const outputJsonPath = resolve(outputDir, 'ff_items.json')
export const outputCsvPath = resolve(outputDir, 'ff_items.csv')
export const reviewedJsonPath = resolve(outputDir, 'ff_items.reviewed.json')
export const reviewedCsvPath = resolve(outputDir, 'ff_items.reviewed.csv')
