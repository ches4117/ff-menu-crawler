export default defineNuxtConfig({
  compatibilityDate: '2026-06-08',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3-flash-preview'
  }
})
