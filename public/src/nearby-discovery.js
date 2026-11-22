import { distanceKm, inNearbyRadius, isPoint, nearbyRadiusKm } from './nearby.js';

const endpoint = 'https://photon.komoot.io/api/';
export const osmAttribution = 'https://www.openstreetmap.org/copyright';
let pauseUntil = 0;
const dishTerms = {
  lemongrass: ['vietnamese', 'vietnamien', 'vietnamita', 'việt', 'lemongrass', 'cơm gà'],
  pasta: ['pasta', 'penne', 'pâtes', 'italian', 'italien', 'italiano'],
  soba: ['soba', 'japanese', 'japonais', 'japonés', 'japanisch', 'nhật'],
  salmon: ['salmon', 'saumon', 'salmón', 'seafood', 'sea food', 'fruits de mer', 'hải sản'],
  rolls: ['vietnamese', 'vietnamien', 'vietnamita', 'việt', 'gỏi cuốn', 'spring rolls'],
  chickpea: ['mediterranean', 'méditerranéen', 'mediterráneo', 'chickpea', 'pois chiche']
};

const text = value => typeof value === 'string' ? value.trim().slice(0, 150) : '';
const normalized = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function featurePoint(feature) {
  if (feature?.type !== 'Feature' || feature.geometry?.type !== 'Point') return null;
  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates)) return null;
  const [lng, lat] = coordinates;
  const point = { lat, lng };
  return isPoint(point) ? point : null;
}

function address(properties) {
  const street = [text(properties.housenumber), text(properties.street)].filter(Boolean).join(' ');
  return [...new Set([street, text(properties.district), text(properties.city ?? properties.locality),
    text(properties.country)].filter(Boolean))].join(', ');
}

function sourceUrl(properties) {
  const element = { N: 'node', W: 'way', R: 'relation' }[properties.osm_type];
  if (!element || !Number.isSafeInteger(properties.osm_id) || properties.osm_id <= 0) return null;
  return `https://www.openstreetmap.org/${element}/${properties.osm_id}`;
}

async function photon(params, signal, request) {
  if (signal.aborted) throw new Error('lookup-unavailable');
  if (Date.now() < pauseUntil) throw new Error('lookup-busy');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 7000);
  try {
    const response = await request(`${endpoint}?${params}`, {
      credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal
    });
    if (response.status === 429) {
      pauseUntil = Date.now() + 30_000;
      throw new Error('lookup-busy');
    }
    if (!response.ok) throw new Error('lookup-unavailable');
    const data = await response.json();
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('lookup-unavailable');
    return data.features;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export async function findAreas(area, signal, request = fetch) {
  const features = await photon(new URLSearchParams({ q: area, limit: '4' }), signal, request);
  return features.slice(0, 4).flatMap(feature => {
    const point = featurePoint(feature);
    const properties = feature?.properties;
    if (!point || !properties) return [];
    const name = text(properties.name) || text(properties.street);
    const detail = address(properties);
    if (!name || !detail) return [];
    return [{ ...point, area: [...new Set([name, detail])].join(', '), openData: true }];
  }).filter((point, index, all) => all.findIndex(candidate => candidate.area === point.area
    && distanceKm(candidate, point) < 0.03) === index);
}

function bounds(point) {
  const lat = Number(point.lat.toFixed(2));
  const lng = Number(point.lng.toFixed(2));
  const latitudeSpan = nearbyRadiusKm / 110 + 0.005;
  const south = Math.max(-90, lat - latitudeSpan);
  const north = Math.min(90, lat + latitudeSpan);
  const longitudeSpan = latitudeSpan / Math.cos(Math.max(Math.abs(south), Math.abs(north)) * Math.PI / 180);
  const wraps = lng - longitudeSpan < -180 || lng + longitudeSpan > 180;
  const [west, east] = wraps ? [-180, 180] : [lng - longitudeSpan, lng + longitudeSpan];
  return { lat, lng, bbox: [west, south, east, north].map(value => value.toFixed(4)).join(',') };
}

export async function findPossiblePlaces(recipeId, point, signal, request = fetch) {
  if (!isPoint(point) || !dishTerms[recipeId]) return [];
  const terms = dishTerms[recipeId];
  const focus = bounds(point);
  const params = new URLSearchParams({ q: terms[0], lat: focus.lat, lon: focus.lng, bbox: focus.bbox, limit: '16' });
  params.append('osm_tag', 'amenity:restaurant');
  params.append('osm_tag', 'amenity:fast_food');
  const features = await photon(params, signal, request);
  const knownTerms = terms.map(term => ` ${normalized(term)} `);
  const matches = features.slice(0, 16).flatMap(feature => {
    const position = featurePoint(feature);
    const properties = feature?.properties;
    if (!position || properties?.osm_key !== 'amenity' || !['restaurant', 'fast_food'].includes(properties.osm_value)) return [];
    const name = text(properties.name);
    const detail = address(properties);
    const source = sourceUrl(properties);
    const searchable = ` ${normalized([name, text(properties.extra?.cuisine)].join(' '))} `;
    if (!name || !detail || !source || !knownTerms.some(term => searchable.includes(term))) return [];
    const km = distanceKm(point, position);
    return inNearbyRadius(km, point) ? [{ ...position, name, address: detail, source, km, openData: true }] : [];
  });
  return matches.filter((place, index, all) => all.findIndex(other => other.source === place.source
    || (normalized(other.name) === normalized(place.name) && distanceKm(other, place) < 0.08)) === index)
    .sort((a, b) => a.km - b.km);
}
