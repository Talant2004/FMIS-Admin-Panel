/**
 * Скачивает сельхозугодья Казахстана из OpenStreetMap (Overpass API),
 * вычисляет центроид каждого поля и сохраняет результат в public/kz-farms.json
 *
 * Запуск:  node scripts/fetch-kz-farms.mjs
 */

import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = join(__dirname, "../public/kz-farms.json")

// Overpass QL — берём центры всех farmland-полигонов в Казахстане
// "out center" возвращает только центральную точку каждого полигона, без полной геометрии — быстро и легко
const OVERPASS_QUERY = `
[out:json][timeout:120];
area["name:en"="Kazakhstan"][admin_level=2]->.kz;
(
  way["landuse"="farmland"](area.kz);
  relation["landuse"="farmland"](area.kz);
);
out center tags;
`.trim()

const OVERPASS_URL = "https://overpass-api.de/api/interpreter"

async function main() {
  console.log("📡 Запрос к Overpass API (может занять 30–60 секунд)…")

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "FMIS-Admin-Panel/1.0",
    },
    body: "data=" + encodeURIComponent(OVERPASS_QUERY),
  })

  if (!res.ok) {
    console.error("❌ Overpass ответил:", res.status, res.statusText)
    process.exit(1)
  }

  const data = await res.json()
  console.log(`✅ Получено ${data.elements.length} элементов`)

  // Преобразуем в список точек { id, lat, lon, name }
  const points = []
  for (const el of data.elements) {
    let lat, lon

    if (el.type === "way" && el.center) {
      lat = el.center.lat
      lon = el.center.lon
    } else if (el.type === "relation" && el.center) {
      lat = el.center.lat
      lon = el.center.lon
    } else {
      continue
    }

    const name = el.tags?.name || el.tags?.["name:ru"] || el.tags?.["name:kk"] || null

    points.push({
      id: `osm-${el.type[0]}${el.id}`,
      lat: Math.round(lat * 10000) / 10000,
      lon: Math.round(lon * 10000) / 10000,
      name,
    })
  }

  // Дедупликация: убираем точки ближе 5 км друг к другу
  // (Open-Meteo сетка ~9 км — смысла брать точки чаще нет)
  console.log(`🔧 Дедупликация (порог 0.045° ≈ 5 км)…`)
  const deduplicated = []
  const THRESHOLD = 0.045 // градусы

  for (const p of points) {
    const tooClose = deduplicated.some(
      q => Math.abs(p.lat - q.lat) < THRESHOLD && Math.abs(p.lon - q.lon) < THRESHOLD
    )
    if (!tooClose) deduplicated.push(p)
  }

  console.log(`✅ После дедупликации: ${deduplicated.length} уникальных точек`)

  // Сохраняем
  mkdirSync(join(__dirname, "../public"), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(deduplicated, null, 2), "utf-8")
  console.log(`💾 Сохранено → public/kz-farms.json`)
  console.log(`\nТеперь открой страницу /forecast — она загрузит эти точки автоматически.`)
}

main().catch(err => {
  console.error("❌ Ошибка:", err.message)
  process.exit(1)
})
