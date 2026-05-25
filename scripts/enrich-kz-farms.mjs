/**
 * Добавляет область и район к каждому полю из kz-farms.json
 * Источник районов: OpenStreetMap admin_level=6 (Казахстан)
 *
 * Запуск: node scripts/enrich-kz-farms.mjs
 */

import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FARMS_FILE = join(__dirname, "../public/kz-farms.json")

const OBLAST_QUERY = `
[out:json][timeout:120];
area["ISO3166-1"="KZ"][admin_level=2]->.kz;
relation["boundary"="administrative"]["admin_level"="4"](area.kz);
out center tags;
`.trim()

const DISTRICT_QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="KZ"][admin_level=2]->.kz;
relation["boundary"="administrative"]["admin_level"="6"](area.kz);
out center tags;
`.trim()

const OVERPASS_URL = "https://overpass-api.de/api/interpreter"

async function overpass(query) {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "FMIS-Admin-Panel/1.0",
    },
    body: "data=" + encodeURIComponent(query),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}`)
  return res.json()
}

function pickName(tags = {}) {
  return tags["name:ru"] || tags.name || tags["name:en"] || tags["name:kk"] || null
}

function pickOblast(tags = {}) {
  return tags["addr:region"] || tags.region || pickName(tags) || null
}

function parseAdmin(elements, level) {
  return elements
    .filter(el => el.type === "relation" && el.center)
    .map(el => ({
      id: `osm-${el.id}`,
      name: pickName(el.tags),
      oblast: el.tags?.["is_in:state"] || el.tags?.["addr:region"] || el.tags?.["is_in:region"] || null,
      lat: el.center.lat,
      lon: el.center.lon,
      adminLevel: level,
      bbox: el.bounds
        ? { minLat: el.bounds.minlat, maxLat: el.bounds.maxlat, minLon: el.bounds.minlon, maxLon: el.bounds.maxlon }
        : null,
    }))
    .filter(r => r.name)
}

function inBbox(lat, lon, bbox) {
  if (!bbox) return false
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon
}

function dist2(lat1, lon1, lat2, lon2) {
  const dlat = lat1 - lat2
  const dlon = lon1 - lon2
  return dlat * dlat + dlon * dlon
}

function assignAdmin(lat, lon, regions) {
  const candidates = regions.filter(r => inBbox(lat, lon, r.bbox))
  const pool = candidates.length > 0 ? candidates : regions

  let best = pool[0]
  let bestDist = Infinity
  for (const r of pool) {
    const d = dist2(lat, lon, r.lat, r.lon)
    if (d < bestDist) {
      bestDist = d
      best = r
    }
  }
  return best
}

async function main() {
  console.log("📡 Загрузка областей…")
  const oblastData = await overpass(OBLAST_QUERY)
  const oblasts = parseAdmin(oblastData.elements, 4)
  console.log(`✅ Областей: ${oblasts.length}`)

  console.log("📡 Загрузка районов…")
  const districtData = await overpass(DISTRICT_QUERY)
  const districts = parseAdmin(districtData.elements, 6)
  console.log(`✅ Районов: ${districts.length}`)

  const farms = JSON.parse(readFileSync(FARMS_FILE, "utf-8"))
  console.log(`🔧 Обогащение ${farms.length} полей…`)

  const enriched = farms.map(farm => {
    const oblast = assignAdmin(farm.lat, farm.lon, oblasts)
    const district = assignAdmin(farm.lat, farm.lon, districts)

    return {
      ...farm,
      oblast: oblast?.name ?? "Не определено",
      district: district?.name ?? "Не определено",
    }
  })

  writeFileSync(FARMS_FILE, JSON.stringify(enriched, null, 2), "utf-8")
  console.log(`💾 Обновлено → public/kz-farms.json`)

  const sample = enriched.filter(f => f.district && f.district !== "Не определено").slice(0, 5)
  console.log("\nПримеры:")
  for (const s of sample) {
    console.log(`  ${s.oblast} / ${s.district} — ${s.lat}, ${s.lon}`)
  }
}

main().catch(err => {
  console.error("❌", err.message)
  process.exit(1)
})
