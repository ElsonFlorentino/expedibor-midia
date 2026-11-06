// Cria a campanha de Awareness da Expedibor para a região da Reparasul 2026 (11 a 14/11, Fenac, Novo Hamburgo/RS).
// A Expedibor NÃO expõe: nenhum criativo cita a feira. A feira só define onde e quando roda.
// ABO, 3 conjuntos por data, R$ 30/dia (07/11 a 05/12 = R$ 870, dentro do limite de gasto da conta).
// 5 anúncios por conjunto: Raio-X v4, estáticos 1 e 2 do plano + vídeo e estático do distribuidor (+25 anos).
// Tudo sobe PAUSED. Revisar e ativar depois.
//
// Uso:
//   node criar-campanha-reparasul.mjs --dry-run
//   node criar-campanha-reparasul.mjs

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { AD_ACCOUNT_ID, PAGE_ID, INSTAGRAM_ID, TOKEN, metaApi } from './lib.mjs'

const DRY_RUN = process.argv.includes('--dry-run')
const STATUS = 'PAUSED'
const LINK = 'https://expedibor.com.br'
const SSD = '/Volumes/SSD Externo/Freelancer/Expedibor/Reparasul-2026'

const MIDIA = {
  videoStory: `${SSD}/expedibor-raiox-v4-9x16.mp4`,
  videoFeed: `${SSD}/expedibor-raiox-v4-4x5.mp4`,
  thumbStory: `${SSD}/thumbs/raiox-v4-9x16.jpg`,
  thumbFeed: `${SSD}/thumbs/raiox-v4-4x5.jpg`,
  est1Story: `${SSD}/estaticos/estatico1-raiox-9x16.png`,
  est1Feed: `${SSD}/estaticos/estatico1-raiox-4x5.png`,
  est2Story: `${SSD}/estaticos/estatico2-catalogo-9x16.png`,
  est2Feed: `${SSD}/estaticos/estatico2-catalogo-4x5.png`,
  distVideoStory: `${SSD}/distribuidor/expedibor-distribuidor-animado-9x16.mp4`,
  distVideoFeed: `${SSD}/distribuidor/expedibor-distribuidor-animado-4x5.mp4`,
  distThumbStory: `${SSD}/thumbs/distribuidor-9x16.jpg`,
  distThumbFeed: `${SSD}/thumbs/distribuidor-4x5.jpg`,
  distEstStory: `${SSD}/distribuidor/estatico-distribuidor-9x16.png`,
  distEstFeed: `${SSD}/distribuidor/estatico-distribuidor-4x5.png`,
}

// Copy sem travessão e sem citar feira
const COPY = {
  video: {
    title: 'Raio-X do carro | Expedibor',
    body: 'Bucha, coxim, tubo de refrigeração e kit de amortecedor. Peças de metal e borracha que a Expedibor fabrica desde 1998, com certificação ISO 9001. Peça Expedibor no seu distribuidor.',
    description: 'Qualidade e confiança, peça por peça',
  },
  est1: {
    title: 'Por dentro do carro, tem Expedibor',
    body: 'Suspensão, motor, câmbio e refrigeração. Mais de 1.300 itens fabricados em fábrica própria, com certificação ISO 9001. Peça Expedibor no seu distribuidor.',
    description: 'Qualidade e confiança, peça por peça',
  },
  est2: {
    title: 'Mais de 1.300 itens em metal e borracha',
    body: 'Buchas, coxins, tubos de refrigeração e kits de amortecedor para carros nacionais e importados. Qualidade e confiança, peça por peça. Peça Expedibor no seu distribuidor.',
    description: 'Expedibor · ISO 9001',
  },
  dist: {
    title: 'Tudo num fornecedor só',
    body: 'Distribuidor de autopeças no RS? A Expedibor fabrica há mais de 25 anos: são mais de 1.300 itens em metal e borracha para suspensão, motor, câmbio, refrigeração e amortecedor, com fábrica própria e certificação ISO 9001. Solicite o catálogo.',
    description: 'Qualidade e confiança, peça por peça',
  },
}

const BASE_TARGETING = { age_min: 21, targeting_automation: { advantage_audience: 1 } }
const ALVOS = {
  regiao: { ...BASE_TARGETING, geo_locations: { custom_locations: [{ latitude: -29.6788, longitude: -51.1306, radius: 60, distance_unit: 'kilometer' }] } }, // Novo Hamburgo + 60 km (Grande POA, Vale do Sinos, Serra)
  fenac: { ...BASE_TARGETING, geo_locations: { custom_locations: [{ latitude: -29.7025, longitude: -51.1379, radius: 3, distance_unit: 'kilometer' }] } },
  rs: { ...BASE_TARGETING, geo_locations: { regions: [{ key: '456' }] } },
}
const FREQUENCY_CAP = [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }]
const DIARIO = 3000 // centavos

const FASES = [
  { nome: '[BR][EXPEDIBOR][F1-PRE][NovoHamburgo60km][Reparasul2026]', alvo: 'regiao', inicio: '2026-11-07T00:00:00-03:00', fim: '2026-11-11T00:00:00-03:00' },
  { nome: '[BR][EXPEDIBOR][F2-DURANTE][Fenac3km][Reparasul2026]', alvo: 'fenac', inicio: '2026-11-11T00:00:00-03:00', fim: '2026-11-15T00:00:00-03:00' },
  { nome: '[BR][EXPEDIBOR][F3-POS][RS][Reparasul2026]', alvo: 'rs', inicio: '2026-11-15T00:00:00-03:00', fim: '2026-12-06T00:00:00-03:00' },
]

function log(msg, dry = false) { console.log(`${dry ? '🔵' : '✅'} ${msg}`) }

async function uploadImage(path) {
  log(`Upload imagem: ${basename(path)}`, DRY_RUN)
  readFileSync(path) // garante que existe
  if (DRY_RUN) return `dry_${basename(path)}`
  const form = new FormData()
  form.append('access_token', TOKEN)
  form.append('bytes', readFileSync(path).toString('base64'))
  const data = await (await fetch(`https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/adimages`, { method: 'POST', body: form })).json()
  if (data.error) throw new Error(`upload imagem falhou (${path}): ${data.error.message}`)
  return Object.values(data.images)[0].hash
}

async function uploadVideo(path) {
  log(`Upload vídeo: ${basename(path)}`, DRY_RUN)
  const buf = readFileSync(path)
  if (DRY_RUN) return `dry_${basename(path)}`
  const form = new FormData()
  form.append('access_token', TOKEN)
  form.append('name', basename(path))
  form.append('source', new Blob([buf], { type: 'video/mp4' }), basename(path))
  const data = await (await fetch(`https://graph-video.facebook.com/v21.0/${AD_ACCOUNT_ID}/advideos`, { method: 'POST', body: form })).json()
  if (data.error) throw new Error(`upload vídeo falhou (${path}): ${data.error.message}`)
  // espera processar
  for (let i = 0; i < 60; i++) {
    const st = await metaApi(`${data.id}?fields=status`)
    if (st.status?.video_status === 'ready') break
    if (st.status?.video_status === 'error') throw new Error(`vídeo ${data.id} com erro no processamento`)
    await new Promise(r => setTimeout(r, 5000))
  }
  log(`  vídeo ${data.id} pronto`)
  return data.id
}

// Um criativo com versão feed (4:5) e stories/reels (9:16)
function assetFeedSpec(copy, midia) {
  const story = { name: 'story' }, feed = { name: 'feed' }
  const spec = {
    bodies: [{ text: copy.body }],
    titles: [{ text: copy.title }],
    descriptions: [{ text: copy.description }],
    link_urls: [{ website_url: LINK }],
    call_to_action_types: ['LEARN_MORE'],
    ad_formats: [midia.tipo === 'video' ? 'SINGLE_VIDEO' : 'SINGLE_IMAGE'],
    optimization_type: 'PLACEMENT',
    asset_customization_rules: [
      { customization_spec: { publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['story', 'facebook_reels'], instagram_positions: ['story', 'reels'] },
        [midia.tipo === 'video' ? 'video_label' : 'image_label']: story, priority: 1 },
      { customization_spec: { age_min: 18, age_max: 65 }, [midia.tipo === 'video' ? 'video_label' : 'image_label']: feed, priority: 2 },
    ],
  }
  if (midia.tipo === 'video') {
    spec.videos = [
      { video_id: midia.story, thumbnail_hash: midia.thumbStory, adlabels: [story] },
      { video_id: midia.feed, thumbnail_hash: midia.thumbFeed, adlabels: [feed] },
    ]
  } else {
    spec.images = [{ hash: midia.story, adlabels: [story] }, { hash: midia.feed, adlabels: [feed] }]
  }
  return spec
}

async function createCreative(nome, copy, midia) {
  log(`Criativo: ${nome}`, DRY_RUN)
  const body = {
    name: nome,
    object_story_spec: JSON.stringify({ page_id: PAGE_ID, instagram_user_id: INSTAGRAM_ID }),
    asset_feed_spec: JSON.stringify(assetFeedSpec(copy, midia)),
  }
  if (DRY_RUN) return `dry_${nome}`
  const data = await metaApi(`${AD_ACCOUNT_ID}/adcreatives`, { method: 'POST', body })
  return data.id
}

async function main() {
  console.log(`EXPEDIBOR · Reparasul 2026 · Awareness · ${DRY_RUN ? 'DRY RUN' : 'PRODUÇÃO (PAUSED)'}`)

  const v = { tipo: 'video', story: await uploadVideo(MIDIA.videoStory), feed: await uploadVideo(MIDIA.videoFeed),
    thumbStory: await uploadImage(MIDIA.thumbStory), thumbFeed: await uploadImage(MIDIA.thumbFeed) }
  const e1 = { tipo: 'image', story: await uploadImage(MIDIA.est1Story), feed: await uploadImage(MIDIA.est1Feed) }
  const e2 = { tipo: 'image', story: await uploadImage(MIDIA.est2Story), feed: await uploadImage(MIDIA.est2Feed) }
  const dv = { tipo: 'video', story: await uploadVideo(MIDIA.distVideoStory), feed: await uploadVideo(MIDIA.distVideoFeed),
    thumbStory: await uploadImage(MIDIA.distThumbStory), thumbFeed: await uploadImage(MIDIA.distThumbFeed) }
  const de = { tipo: 'image', story: await uploadImage(MIDIA.distEstStory), feed: await uploadImage(MIDIA.distEstFeed) }

  const criativos = {
    video: await createCreative('[CRIATIVO][Reparasul2026][Video-RaioX-v4]', COPY.video, v),
    est1: await createCreative('[CRIATIVO][Reparasul2026][Estatico1-RaioX]', COPY.est1, e1),
    est2: await createCreative('[CRIATIVO][Reparasul2026][Estatico2-Catalogo]', COPY.est2, e2),
    distVideo: await createCreative('[CRIATIVO][Reparasul2026][Video-Distribuidor]', COPY.dist, dv),
    distEst: await createCreative('[CRIATIVO][Reparasul2026][Estatico-Distribuidor]', COPY.dist, de),
  }

  log('Campanha', DRY_RUN)
  const campanha = DRY_RUN ? 'dry_campaign' : (await metaApi(`${AD_ACCOUNT_ID}/campaigns`, { method: 'POST', body: {
    name: '[BR][EXPEDIBOR][AWARENESS][ABO][Reparasul2026]', objective: 'OUTCOME_AWARENESS', status: STATUS,
    special_ad_categories: '[]', is_adset_budget_sharing_enabled: 'false' } })).id

  for (const f of FASES) {
    log(`Conjunto: ${f.nome} (R$ ${(DIARIO / 100).toFixed(2)}/dia, ${f.inicio.slice(0, 10)} a ${f.fim.slice(0, 10)})`, DRY_RUN)
    const adset = DRY_RUN ? 'dry_adset' : (await metaApi(`${AD_ACCOUNT_ID}/adsets`, { method: 'POST', body: {
      campaign_id: campanha, name: f.nome, daily_budget: DIARIO, bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: JSON.stringify(ALVOS[f.alvo]), optimization_goal: 'REACH', billing_event: 'IMPRESSIONS',
      frequency_control_specs: JSON.stringify(FREQUENCY_CAP), start_time: f.inicio, end_time: f.fim, status: STATUS } })).id
    for (const [k, cr] of Object.entries(criativos)) {
      const nome = `${f.nome.split('][')[2]}][${k}`
      log(`  Anúncio: ${nome}`, DRY_RUN)
      if (!DRY_RUN) await metaApi(`${AD_ACCOUNT_ID}/ads`, { method: 'POST', body: { name: `[BR][EXPEDIBOR][${nome}]`, adset_id: adset, creative: JSON.stringify({ creative_id: cr }), status: STATUS } })
    }
  }
  console.log(`\nCampanha: ${campanha}. Tudo PAUSED.`)
}

main().catch(e => { console.error('❌', e.metaError ?? e.message); process.exit(1) })
