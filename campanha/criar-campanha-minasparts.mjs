// Cria a campanha de Awareness da Expedibor para a MinasParts 2026.
// Instagram-only, ABO (orçamento por conjunto, um por fase do plano de mídia).
// Todos os anúncios sobem com status PAUSED — revisar no Ads Manager antes de ativar.
//
// Uso:
//   node criar-campanha-minasparts.mjs --dry-run   # valida sem criar nada
//   node criar-campanha-minasparts.mjs              # cria de verdade (PAUSED)

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AD_ACCOUNT_ID, PAGE_ID, metaApi } from './lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')
const STATUS = 'PAUSED'
const LINK = 'https://expedibor.com.br'

const CRIATIVOS_DIR = resolve(__dirname, '..', 'assets', 'criativos-agosto-2026')
const IMG = {
  minasparts: 'Expedibor na MinasParts 2026.png',
  fabrica: 'Fábrica renovada com logo Expedibor.png',
  pecas: 'Peças Expedibor, oficina sem parar.png',
  bastidores: 'Bastidores da fábrica_ precisão e produção.png',
  inspecao: 'Inspeção digital na fábrica Expedibor.png',
}

// ============================================================
// TARGETING — Instagram-only (publisher_platforms:['instagram'])
// ============================================================
const TARGETING_MG = {
  age_min: 21,
  geo_locations: { regions: [{ key: '449' }] }, // Minas Gerais
  targeting_automation: { advantage_audience: 1 },
  publisher_platforms: ['instagram'],
  instagram_positions: ['stream', 'story', 'reels'],
  device_platforms: ['mobile', 'desktop'],
}

const TARGETING_EXPOMINAS = {
  age_min: 21,
  geo_locations: {
    custom_locations: [
      { latitude: -19.9321, longitude: -43.9888, radius: 10, distance_unit: 'kilometer' },
    ],
  },
  targeting_automation: { advantage_audience: 1 },
  publisher_platforms: ['instagram'],
  instagram_positions: ['stream', 'story', 'reels'],
  device_platforms: ['mobile', 'desktop'],
}

// Reach com limite de frequência (2-3x/semana) — conforme plano de mídia
const FREQUENCY_CAP = [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }]

// ============================================================
// COPY — sem travessão, humanizada
// ============================================================
const COPY = {
  minasparts_fase1: {
    headline: 'A Expedibor estará na MinasParts 2026',
    primary_text:
      'De 30 de setembro a 3 de outubro, no Expominas em Belo Horizonte. Peças automotivas com qualidade ISO 9001, direto de quem fabrica. Vem conhecer nossa linha completa.',
    description: 'MinasParts 2026 · Expominas BH',
  },
  fabrica_fase1: {
    headline: 'Expedibor, indústria de peças automotivas',
    primary_text:
      'Fábrica própria em Ferraz de Vasconcelos, certificação ISO 9001 e uma linha completa de buchas, batentes e coxins pro seu ponto de venda. Conheça a Expedibor.',
    description: 'Qualidade que dura o giro todo',
  },
  minasparts_fase2: {
    headline: 'Estamos na MinasParts 2026, venha ao nosso estande',
    primary_text:
      'A Expedibor está no Expominas até dia 3 de outubro. Se você trabalha com reposição automotiva em Minas Gerais, aproveita pra conhecer nossa linha de peças de perto.',
    description: 'Expominas · Belo Horizonte',
  },
  pecas_fase2: {
    headline: 'Peças que mantêm a oficina girando',
    primary_text:
      'Buchas, batentes e coxins com a qualidade que o seu cliente final sente. Vem conferir na MinasParts 2026, estamos no Expominas até dia 3 de outubro.',
    description: 'Expedibor · Reposição automotiva',
  },
  bastidores_fase3: {
    headline: 'Obrigado por nos visitar na MinasParts 2026',
    primary_text:
      'Foi bom reencontrar o trade de reposição de Minas Gerais na feira. Segue com a gente pra conhecer mais da nossa linha de peças automotivas.',
    description: 'Expedibor · Indústria de peças automotivas',
  },
  inspecao_fase3: {
    headline: 'Qualidade que a gente confere peça por peça',
    primary_text:
      'Cada peça que sai da nossa fábrica passa por inspeção rigorosa antes de chegar até você. Foi um prazer mostrar isso de perto na MinasParts 2026.',
    description: 'ISO 9001 · Ferraz de Vasconcelos/SP',
  },
}

// ============================================================
// ORÇAMENTO — R$ 1.500/mês bruto, líquido de impostos Meta BR
// (ISS 2,9% + PIS/COFINS 9,25% = 12,15%)
// Fase 0 (teaser) não será usada — verba fica de reserva, sem realocar.
// ============================================================
const NET_MONTHLY = 1500 * (1 - 0.1215) // R$ 1.317,75

const FASES = {
  fase1: { pct: 0.45, dias: 14, inicio: '2026-09-16T00:00:00-03:00', fim: '2026-09-30T00:00:00-03:00' },
  fase2: { pct: 0.35, dias: 4, inicio: '2026-09-30T00:00:00-03:00', fim: '2026-10-04T00:00:00-03:00' },
  fase3: { pct: 0.10, dias: 7, inicio: '2026-10-04T00:00:00-03:00', fim: '2026-10-11T00:00:00-03:00' },
}

function dailyBudgetCents(fase) {
  const total = NET_MONTHLY * fase.pct
  return Math.round((total / fase.dias) * 100)
}

// ============================================================
// HELPERS
// ============================================================
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
  const { TOKEN } = await import('./lib.mjs')
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

async function createCampaign(name) {
  log(`Criando campanha: ${name}`)
  if (DRY_RUN) {
    log('[DRY] campanha não criada', 'DRY')
    return 'dry_campaign_id'
  }
  const data = await metaApi(`${AD_ACCOUNT_ID}/campaigns`, {
    method: 'POST',
    body: {
      name,
      objective: 'OUTCOME_AWARENESS',
      status: STATUS,
      special_ad_categories: '[]',
      is_adset_budget_sharing_enabled: 'false',
    },
  })
  log(`Campanha criada: ${data.id}`)
  return data.id
}

async function createAdSet(campaignId, name, targeting, dailyBudget, startTime, endTime) {
  log(`  Conjunto: ${name} (R$ ${(dailyBudget / 100).toFixed(2)}/dia)`)
  if (DRY_RUN) {
    log('  [DRY] conjunto não criado', 'DRY')
    return `dry_adset_${name}`
  }
  const data = await metaApi(`${AD_ACCOUNT_ID}/adsets`, {
    method: 'POST',
    body: {
      campaign_id: campaignId,
      name,
      daily_budget: dailyBudget,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: JSON.stringify(targeting),
      optimization_goal: 'REACH',
      billing_event: 'IMPRESSIONS',
      frequency_control_specs: JSON.stringify(FREQUENCY_CAP),
      start_time: startTime,
      end_time: endTime,
      status: STATUS,
    },
  })
  log(`  Conjunto criado: ${data.id}`)
  return data.id
}

async function createCreative(name, imageHash, copy) {
  log(`    Criativo: ${name}`)
  if (DRY_RUN) {
    log('    [DRY] criativo não criado', 'DRY')
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
  log(`    Criativo criado: ${data.id}`)
  return data.id
}

async function createAd(adsetId, name, creativeId) {
  log(`      Anúncio: ${name}`)
  if (DRY_RUN) {
    log('      [DRY] anúncio não criado', 'DRY')
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
  log(`      Anúncio criado: ${data.id}`)
  return data.id
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('='.repeat(60))
  console.log('EXPEDIBOR — MinasParts 2026 — Awareness (Instagram-only)')
  console.log(`Verba bruta: R$ 1.500/mês | líquida de impostos: R$ ${NET_MONTHLY.toFixed(2)}/mês`)
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sem criar nada)' : 'PRODUÇÃO (status PAUSED)'}`)
  console.log('='.repeat(60))

  const campaignId = await createCampaign('[BR][EXPEDIBOR][AWARENESS][ABO][MinasParts2026]')

  const hashes = {
    minasparts: await uploadImage(IMG.minasparts),
    fabrica: await uploadImage(IMG.fabrica),
    pecas: await uploadImage(IMG.pecas),
    bastidores: await uploadImage(IMG.bastidores),
    inspecao: await uploadImage(IMG.inspecao),
  }

  // ---- Fase 1 — Intensificação (16/09–29/09) ----
  console.log('\n--- FASE 1 · Intensificação (16/09–29/09) ---')
  const adset1 = await createAdSet(
    campaignId,
    '[BR][EXPEDIBOR][FASE1-INTENSIFICACAO][MG][MinasParts2026]',
    TARGETING_MG,
    dailyBudgetCents(FASES.fase1),
    FASES.fase1.inicio,
    FASES.fase1.fim
  )
  const cr1a = await createCreative('[CRIATIVO][FASE1][MinasParts-Anuncio]', hashes.minasparts, COPY.minasparts_fase1)
  await createAd(adset1, '[BR][EXPEDIBOR][FASE1][MinasParts-Anuncio]', cr1a)
  const cr1b = await createCreative('[CRIATIVO][FASE1][Fabrica-Marca]', hashes.fabrica, COPY.fabrica_fase1)
  await createAd(adset1, '[BR][EXPEDIBOR][FASE1][Fabrica-Marca]', cr1b)

  // ---- Fase 2 — Durante a feira (30/09–03/10) ----
  console.log('\n--- FASE 2 · Durante a feira (30/09–03/10) ---')
  const adset2 = await createAdSet(
    campaignId,
    '[BR][EXPEDIBOR][FASE2-DURANTE-FEIRA][ExpominasGeo][MinasParts2026]',
    TARGETING_EXPOMINAS,
    dailyBudgetCents(FASES.fase2),
    FASES.fase2.inicio,
    FASES.fase2.fim
  )
  const cr2a = await createCreative('[CRIATIVO][FASE2][MinasParts-Estande]', hashes.minasparts, COPY.minasparts_fase2)
  await createAd(adset2, '[BR][EXPEDIBOR][FASE2][MinasParts-Estande]', cr2a)
  const cr2b = await createCreative('[CRIATIVO][FASE2][Pecas-Oficina]', hashes.pecas, COPY.pecas_fase2)
  await createAd(adset2, '[BR][EXPEDIBOR][FASE2][Pecas-Oficina]', cr2b)

  // ---- Fase 3 — Pós-feira (04/10–10/10) ----
  console.log('\n--- FASE 3 · Pós-feira (04/10–10/10) ---')
  const adset3 = await createAdSet(
    campaignId,
    '[BR][EXPEDIBOR][FASE3-POS-FEIRA][MG][MinasParts2026]',
    TARGETING_MG,
    dailyBudgetCents(FASES.fase3),
    FASES.fase3.inicio,
    FASES.fase3.fim
  )
  const cr3a = await createCreative('[CRIATIVO][FASE3][Bastidores-Recap]', hashes.bastidores, COPY.bastidores_fase3)
  await createAd(adset3, '[BR][EXPEDIBOR][FASE3][Bastidores-Recap]', cr3a)
  const cr3b = await createCreative('[CRIATIVO][FASE3][Inspecao-Qualidade]', hashes.inspecao, COPY.inspecao_fase3)
  await createAd(adset3, '[BR][EXPEDIBOR][FASE3][Inspecao-Qualidade]', cr3b)

  console.log('\n' + '='.repeat(60))
  console.log('RESUMO')
  console.log('='.repeat(60))
  console.log(`Campanha: ${campaignId}`)
  console.log(`  Fase 1 (MG, 16/09–29/09): ${adset1} — R$ ${(dailyBudgetCents(FASES.fase1) / 100).toFixed(2)}/dia`)
  console.log(`  Fase 2 (Expominas 10km, 30/09–03/10): ${adset2} — R$ ${(dailyBudgetCents(FASES.fase2) / 100).toFixed(2)}/dia`)
  console.log(`  Fase 3 (MG, 04/10–10/10): ${adset3} — R$ ${(dailyBudgetCents(FASES.fase3) / 100).toFixed(2)}/dia`)
  console.log('\n⚠️  TUDO CRIADO COM STATUS PAUSED.')
  console.log('📋 Revisar no Ads Manager antes de ativar:')
  console.log('   1. Visual dos 6 criativos')
  console.log('   2. Textos e CTAs')
  console.log('   3. Link de destino (expedibor.com.br)')
  console.log('   4. Ativar Fase 1 primeiro, próximo de 16/09')
}

main().catch(e => {
  console.error('❌ ERRO:', e.metaError ?? e.message)
  process.exit(1)
})
