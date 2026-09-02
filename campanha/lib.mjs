// Helpers pra API de Marketing do Meta — usados pelos scripts de criação de campanha.
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_VERSION = 'v21.0'

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env')
  const raw = readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

export const env = loadEnv()
export const AD_ACCOUNT_ID = env.META_AD_ACCOUNT_ID
export const TOKEN = env.META_SYSTEM_USER_TOKEN
export const INSTAGRAM_ID = env.META_INSTAGRAM_ACCOUNT_ID
export const PAGE_ID = env.META_PAGE_ID

if (!AD_ACCOUNT_ID || !TOKEN) {
  throw new Error('META_AD_ACCOUNT_ID e META_SYSTEM_USER_TOKEN precisam estar no .env')
}

export async function metaApi(path, { method = 'GET', body } = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)
  const init = { method, headers: {} }

  if (method === 'GET') {
    if (body) for (const [k, v] of Object.entries(body)) url.searchParams.set(k, v)
    url.searchParams.set('access_token', TOKEN)
  } else {
    const form = new URLSearchParams()
    for (const [k, v] of Object.entries(body ?? {})) {
      form.set(k, typeof v === 'string' ? v : JSON.stringify(v))
    }
    form.set('access_token', TOKEN)
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    init.body = form
  }

  const res = await fetch(url, init)
  const data = await res.json()
  if (data.error) {
    const err = new Error(`Meta API erro: ${data.error.message}`)
    err.metaError = data.error
    throw err
  }
  return data
}
