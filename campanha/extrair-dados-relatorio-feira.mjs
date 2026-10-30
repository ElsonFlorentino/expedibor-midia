// Extrai (só leitura) dados de alcance/entrega da Meta e do Google Ads para a
// seção "interesse em Minas na data da feira" do relatório. Sem valores de gasto.
// Uso: node extrair-dados-relatorio-feira.mjs  → grava ../docs/relatorio-google-ga4/*.json
import { writeFileSync } from 'node:fs'
import { metaApi, AD_ACCOUNT_ID } from './lib.mjs'
import { googleAdsApi, CUSTOMER_ID } from './google-lib.mjs'

const OUT = new URL('../docs/relatorio-google-ga4/', import.meta.url)
const DE = '2026-08-01'
const ATE = '2026-10-29'

async function metaPaged(path, body) {
  const rows = []
  let res = await metaApi(path, { body })
  rows.push(...(res.data ?? []))
  while (res.paging?.next) {
    res = await (await fetch(res.paging.next)).json()
    rows.push(...(res.data ?? []))
  }
  return rows
}

const range = JSON.stringify({ since: DE, until: ATE })
const metaDiario = await metaPaged(`${AD_ACCOUNT_ID}/insights`, {
  level: 'adset', time_range: range, time_increment: 1,
  fields: 'adset_name,campaign_name,impressions,reach,clicks,inline_link_clicks,video_play_actions', limit: 500,
})
const metaRegiao = await metaPaged(`${AD_ACCOUNT_ID}/insights`, {
  level: 'account', time_range: range, breakdowns: 'region',
  fields: 'impressions,reach,clicks', limit: 500,
})
const metaFase = await metaPaged(`${AD_ACCOUNT_ID}/insights`, {
  level: 'adset', time_range: range,
  fields: 'adset_name,impressions,reach,frequency,clicks,inline_link_clicks', limit: 500,
})
const metaTotal = await metaPaged(`${AD_ACCOUNT_ID}/insights`, {
  level: 'account', time_range: range, fields: 'impressions,reach,frequency,clicks,inline_link_clicks',
})
writeFileSync(new URL('meta.json', OUT), JSON.stringify({ metaDiario, metaRegiao, metaFase, metaTotal }, null, 1))

async function gq(query) {
  const data = await googleAdsApi(CUSTOMER_ID, 'googleAds:search', { method: 'POST', body: { query } })
  return data.results ?? []
}
const gDiario = await gq(`SELECT segments.date, campaign.name, campaign.advertising_channel_type,
  metrics.impressions, metrics.clicks, metrics.video_trueview_views, metrics.interactions
  FROM campaign WHERE segments.date BETWEEN '${DE}' AND '${ATE}' AND metrics.impressions > 0`)
const gGeo = await gq(`SELECT geographic_view.country_criterion_id, geographic_view.location_type,
  segments.geo_target_region, metrics.impressions, metrics.clicks, metrics.video_trueview_views
  FROM geographic_view WHERE segments.date BETWEEN '${DE}' AND '${ATE}'`)
const gCidade = await gq(`SELECT segments.geo_target_city, segments.geo_target_region, metrics.impressions, metrics.clicks
  FROM user_location_view WHERE segments.date BETWEEN '${DE}' AND '${ATE}' AND metrics.impressions > 0`).catch(e => ({ erro: String(e) }))
writeFileSync(new URL('google.json', OUT), JSON.stringify({ gDiario, gGeo, gCidade }, null, 1))
console.log('meta diário', metaDiario.length, 'região', metaRegiao.length, '| google diário', gDiario.length, 'geo', gGeo.length)
