// Tipos de POI que buscamos (OpenStreetMap tags)
const POI_TAGS = `
  node["historic"](around:150,LAT,LON);
  node["tourism"~"museum|attraction|monument|artwork|viewpoint|gallery|memorial"](around:150,LAT,LON);
  node["amenity"~"place_of_worship|theatre|cinema|library"](around:150,LAT,LON);
  node["leisure"~"park|garden"](around:200,LAT,LON);
  node["shop"~"mall|market"](around:100,LAT,LON);
  node["building"~"cathedral|church|chapel|mosque|synagogue|temple|castle|palace"](around:150,LAT,LON);
  way["historic"](around:150,LAT,LON);
  way["tourism"~"museum|attraction|monument|artwork|viewpoint|gallery|memorial"](around:150,LAT,LON);
  way["amenity"~"place_of_worship|theatre"](around:150,LAT,LON);
  way["leisure"~"park|garden"](around:200,LAT,LON);
  way["building"~"cathedral|church|chapel|mosque|synagogue|temple|castle|palace"](around:150,LAT,LON);
`

// Iconos por tipo de lugar
export function poiIcon(poi) {
  const t = poi.tags || {}
  if (t.historic === 'monument' || t.historic === 'memorial')   return '🗿'
  if (t.historic === 'castle')                                   return '🏰'
  if (t.historic === 'ruins')                                    return '🏚️'
  if (t.historic)                                                return '🏛️'
  if (t.tourism === 'museum')                                    return '🏛️'
  if (t.tourism === 'artwork')                                   return '🎨'
  if (t.tourism === 'viewpoint')                                 return '🌅'
  if (t.tourism === 'gallery')                                   return '🖼️'
  if (t.amenity === 'place_of_worship') {
    if (t.religion === 'muslim')  return '🕌'
    if (t.religion === 'jewish')  return '🕍'
    return '⛪'
  }
  if (t.amenity === 'theatre')                                   return '🎭'
  if (t.amenity === 'library')                                   return '📚'
  if (t.leisure === 'park' || t.leisure === 'garden')           return '🌳'
  if (t.shop === 'mall' || t.shop === 'market')                 return '🏪'
  if (t.building === 'cathedral')                                return '⛪'
  return '📍'
}

// Tipo legible del POI
export function poiType(poi) {
  const t = poi.tags || {}
  const map = {
    historic: { monument:'Monumento', memorial:'Memorial', castle:'Castillo', ruins:'Ruinas', building:'Edificio histórico', archaeological_site:'Sitio arqueológico', wayside_shrine:'Santuario', fort:'Fuerte' },
    tourism:  { museum:'Museo', attraction:'Atracción turística', monument:'Monumento', artwork:'Obra de arte', viewpoint:'Mirador', gallery:'Galería', memorial:'Memorial' },
    amenity:  { place_of_worship:'Lugar de culto', theatre:'Teatro', cinema:'Cine', library:'Biblioteca' },
    leisure:  { park:'Parque', garden:'Jardín' },
    shop:     { mall:'Centro comercial', market:'Mercado' },
    building: { cathedral:'Catedral', church:'Iglesia', chapel:'Capilla', mosque:'Mezquita', synagogue:'Sinagoga', temple:'Templo', castle:'Castillo', palace:'Palacio' },
  }
  for (const [key, vals] of Object.entries(map)) {
    if (t[key] && vals[t[key]]) return vals[t[key]]
  }
  return 'Lugar de interés'
}

// Nombre del POI
export function poiName(poi) {
  const t = poi.tags || {}
  return t.name || t['name:es'] || t['name:en'] || null
}

// Distancia en metros entre dos coords
export function distance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

// Consulta Overpass API
export async function fetchNearbyPOI(lat, lon) {
  const query = `[out:json][timeout:10];(${POI_TAGS.replaceAll('LAT', lat).replaceAll('LON', lon)});out body center 20;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
  })
  if (!res.ok) throw new Error('Overpass error')
  const data = await res.json()

  // Procesar elementos: sacar lat/lon de ways (usan center)
  const elements = (data.elements || []).map(el => ({
    ...el,
    lat: el.lat ?? el.center?.lat,
    lon: el.lon ?? el.center?.lon,
  })).filter(el => el.lat && el.lon && poiName(el))

  // Calcular distancia y ordenar
  const withDist = elements.map(el => ({
    ...el,
    dist: distance(lat, lon, el.lat, el.lon),
  })).sort((a, b) => a.dist - b.dist)

  // Deduplicar por nombre
  const seen = new Set()
  return withDist.filter(el => {
    const n = poiName(el)
    if (seen.has(n)) return false
    seen.add(n)
    return true
  }).slice(0, 8)
}
