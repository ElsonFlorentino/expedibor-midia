// Teste isolado: sobe UMA imagem e tenta criar UM ad creative (sem campanha,
// sem ad set, sem gasto nenhum) — agora incluindo page_id (Página criada:
// 1185077328031902) junto de instagram_actor_id no object_story_spec.
import { readFileSync } from 'node:fs'
import { AD_ACCOUNT_ID, INSTAGRAM_ID, PAGE_ID, TOKEN, metaApi } from './lib.mjs'

const imagePath = process.argv[2]
if (!imagePath) {
  console.error('Uso: node teste-criativo.mjs <caminho-da-imagem>')
  process.exit(1)
}

async function uploadImage(path) {
  const buffer = readFileSync(path)
  const form = new FormData()
  form.append('access_token', (await import('./lib.mjs')).TOKEN)
  form.append('bytes', buffer.toString('base64'))

  const res = await fetch(`https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/adimages`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (data.error) throw new Error(`upload falhou: ${data.error.message}`)
  const key = Object.keys(data.images)[0]
  return data.images[key].hash
}

async function main() {
  console.log(`Fazendo upload de ${imagePath}...`)
  const imageHash = await uploadImage(imagePath)
  console.log(`✓ imagem enviada, hash: ${imageHash}`)

  console.log(`\nTentando criar ad creative só com page_id (${PAGE_ID}), sem instagram_actor_id — igual ao padrão usado no Boost...`)
  try {
    const creative = await metaApi(`${AD_ACCOUNT_ID}/adcreatives`, {
      method: 'POST',
      body: {
        name: 'TESTE — apagar depois',
        object_story_spec: JSON.stringify({
          page_id: PAGE_ID,
          link_data: {
            image_hash: imageHash,
            link: 'https://expedibor.com.br',
            message: 'Teste de criativo — não usar',
          },
        }),
      },
    })
    console.log('✓ FUNCIONOU! creative id:', creative.id)
    console.log('\nApagando o creative de teste...')
    const delUrl = `https://graph.facebook.com/v21.0/${creative.id}?access_token=${TOKEN}`
    await fetch(delUrl, { method: 'DELETE' }).catch(() => {})
    console.log('✓ limpo.')
  } catch (e) {
    console.log('✗ Falhou:')
    console.log(JSON.stringify(e.metaError ?? e.message, null, 2))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
