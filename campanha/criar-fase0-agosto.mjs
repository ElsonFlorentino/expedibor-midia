// Fase 0 — Agosto: teaser institucional usando os 5 criativos já prontos,
// dentro da mesma campanha de Awareness da MinasParts 2026 (Instagram-only).
// Usa a sobra de verba (10% não realocado pro teaser original) — 25 dias
// a partir de hoje, R$ 5,27/dia (acima do mínimo da conta, R$ 5,14/dia).
//
// Uso:
//   node criar-fase0-agosto.mjs --dry-run
//   node criar-fase0-agosto.mjs

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AD_ACCOUNT_ID, PAGE_ID, TOKEN, metaApi } from './lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')
const STATUS = 'PAUSED'
const LINK = 'https://expedibor.com.br'
const CAMPAIGN_ID = '120249887410870518' // [BR][EXPEDIBOR][AWARENESS][ABO][MinasParts2026]

const CRIATIVOS_DIR = resolve(__dirname, '..', 'assets', 'criativos-agosto-2026')

const TARGETING_MG = {
  age_min: 21,
  geo_locations: { regions: [{ key: '449' }] }, // Minas Gerais
  targeting_automation: { advantage_audience: 1 },
  publisher_platforms: ['instagram'],
  instagram_positions: ['stream', 'story', 'reels'],
  device_platforms: ['mobile', 'desktop'],
}

const FREQUENCY_CAP = [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }]

const DAILY_BUDGET_CENTS = 527 // R$131,78 / 25 dias
const START_TIME = '2026-08-11T00:00:00-03:00'
const END_TIME = '2026-09-05T00:00:00-03:00' // 25 dias

const ADS = [
  {
    file: '20 anos de confiança',
    image: 'Fábrica renovada com logo Expedibor.png',
    copy: {
      headline: '20 anos fabricando peças automotivas',
      primary_text:
        'Duas décadas produzindo buchas, batentes e coxins com certificação ISO 9001, direto de Ferraz de Vasconcelos/SP. Confiança que o seu ponto de venda sente na hora de girar o estoque.',
      description: 'Expedibor · 20 anos de confiança',
    },
  },
  {
    file: 'Oficina não pode parar',
    image: 'Peças Expedibor, oficina sem parar.png',
    copy: {
      headline: 'Sua oficina não pode parar',
      primary_text:
        'Linha completa de suspensão: buchas, batentes e coxins com a qualidade que segura o giro da sua oficina. Conheça a linha Expedibor.',
      description: 'Linha completa de suspensão',
    },
  },
  {
    file: 'Bastidores da fábrica',
    image: 'Bastidores da fábrica_ precisão e produção.png',
    copy: {
      headline: 'Mais de 10 mil peças saem da nossa fábrica todo dia',
      primary_text:
        'Por trás de cada peça Expedibor tem inspeção rigorosa e produção em escala. Conheça um pouco dos bastidores da nossa fábrica.',
      description: 'Bastidores da fábrica Expedibor',
    },
  },
  {
    file: 'Inspeção digital',
    image: 'Inspeção digital na fábrica Expedibor.png',
    copy: {
      headline: 'Produção em escala, qualidade peça por peça',
      primary_text:
        'Mais de 10 mil peças por dia saem da nossa fábrica em Ferraz de Vasconcelos, sempre com inspeção rigorosa antes de chegar até você.',
      description: 'ISO 9001 · Ferraz de Vasconcelos/SP',
    },
  },
  {
    file: 'Salva a data MinasParts',
    image: 'Expedibor na MinasParts 2026.png',
    copy: {
      headline: 'Anota na agenda: MinasParts 2026',
      primary_text:
        'De 30 de setembro a 3 de outubro, no Expominas em Belo Horizonte. A Expedibor vai estar lá, com estande próprio. Guarda a data.',
      description: 'MinasParts 2026 · Expominas BH',
    },
  },
]

function log(msg, level = 'INFO') {
  const prefix = { INFO: '✅', DRY: '🔵', ERR: '❌' }[level] ?? '  '
  console.log(`${prefix} ${msg}`)
}

async function uploadImage(filename) {
  const path = resolve(CRIATIVOS_DIR, filename)
  log(`Upload: ${filename}`)
  if (DRY_RUN) {
    log('[DRY] upload ignorado', 'DRY')
    return `dry_hash_${filename}`
  }
  const buffer = readFileSync(path)
  const form = new FormData()
  form.append('access_token', TOKEN)
  form.append('bytes', buffer.toString('base64'))
  const res = await fetch(`https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/adimages`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (data.error) throw new Error(`upload falhou (${filename}): ${data.error.message}`)
  const key = Object.keys(data.images)[0]
  const hash = data.images[key].hash
  log(`  hash: ${hash}`)
  return hash
}

async function createAdSet() {
  const name = '[BR][EXPEDIBOR][FASE0-AGOSTO][MG][MinasParts2026]'
  log(`Conjunto: ${name} (R$ ${(DAILY_BUDGET_CENTS / 100).toFixed(2)}/dia)`)
  if (DRY_RUN) {
    log('[DRY] conjunto não criado', 'DRY')
    return 'dry_adset_fase0'
  }
  const data = await metaApi(`${AD_ACCOUNT_ID}/adsets`, {
    method: 'POST',
    body: {
      campaign_id: CAMPAIGN_ID,
      name,
      daily_budget: DAILY_BUDGET_CENTS,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: JSON.stringify(TARGETING_MG),
      optimization_goal: 'REACH',
      billing_event: 'IMPRESSIONS',
      frequency_control_specs: JSON.stringify(FREQUENCY_CAP),
      start_time: START_TIME,
      end_time: END_TIME,
      status: STATUS,
    },
  })
  log(`Conjunto criado: ${data.id}`)
  return data.id
}

async function createCreative(name, imageHash, copy) {
  log(`  Criativo: ${name}`)
  if (DRY_RUN) {
    log('  [DRY] criativo não criado', 'DRY')
    return `dry_creative_${name}`
  }
  const data = await metaApi(`${AD_ACCOUNT_ID}/adcreatives`, {
    method: 'POST',
    body: {
      name,
      object_story_spec: JSON.stringify({
        page_id: PAGE_ID,
        link_data: {
          image_hash: imageHash,
          link: LINK,
          message: copy.primary_text,
          name: copy.headline,
          description: copy.description,
          call_to_action: { type: 'LEARN_MORE', value: { link: LINK } },
        },
      }),
    },
  })
  log(`  Criativo criado: ${data.id}`)
  return data.id
}

async function createAd(adsetId, name, creativeId) {
  log(`    Anúncio: ${name}`)
  if (DRY_RUN) {
    log('    [DRY] anúncio não criado', 'DRY')
    return `dry_ad_${name}`
  }
  const data = await metaApi(`${AD_ACCOUNT_ID}/ads`, {
    method: 'POST',
    body: {
      name,
      adset_id: adsetId,
      creative: JSON.stringify({ creative_id: creativeId }),
      status: STATUS,
    },
  })
  log(`    Anúncio criado: ${data.id}`)
  return data.id
}

async function main() {
  console.log('='.repeat(60))
  console.log('EXPEDIBOR — Fase 0 · Agosto (teaser institucional)')
  console.log(`Campanha: ${CAMPAIGN_ID}`)
  console.log(`Janela: 11/08 a 04/09 (25 dias) | R$ ${(DAILY_BUDGET_CENTS / 100).toFixed(2)}/dia`)
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'PRODUÇÃO (status PAUSED)'}`)
  console.log('='.repeat(60))

  const adsetId = await createAdSet()

  for (const ad of ADS) {
    const hash = await uploadImage(ad.image)
    const creativeId = await createCreative(`[CRIATIVO][FASE0][${ad.file}]`, hash, ad.copy)
    await createAd(adsetId, `[BR][EXPEDIBOR][FASE0][${ad.file}]`, creativeId)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`RESUMO — Conjunto Fase 0: ${adsetId}`)
  console.log('5 anúncios criados, status PAUSED.')
  console.log('Ativar quando revisar no Ads Manager — já está com start_time hoje.')
}

main().catch(e => {
  console.error('❌ ERRO:', e.metaError ?? e.message)
  process.exit(1)
})
