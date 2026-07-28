const fs = require('fs')

const en = JSON.parse(fs.readFileSync('./src/locales/en.json', 'utf-8'))

async function translateText(text, targetLang) {
  const params = new URLSearchParams({
    q: text,
    langpair: `en|${targetLang}`
  })
  const res = await fetch(`https://api.mymemory.translated.net/get?${params}`)
  const data = await res.json()
  return data.responseData.translatedText
}

async function run() {
  const fr = {}
  for (const [key, value] of Object.entries(en)) {
    const translated = await translateText(value, 'fr')
    fr[key] = translated
    console.log(`${key}: "${value}" -> "${translated}"`)
    // small delay to be polite to the free API
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  fs.writeFileSync('./src/locales/fr.json', JSON.stringify(fr, null, 2))
  console.log('\nDone! fr.json written.')
}

run()