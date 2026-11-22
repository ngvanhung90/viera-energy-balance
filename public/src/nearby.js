import { recipes } from './catalog.js';
import { calories, mapsUrl, mealPreferenceScore } from './planner.js';
import { servingOptions } from './storage.js';

export const nearbyRadiusKm = 5;
// Source links and position provenance are documented in the README.
export const benThanh = { lat: 10.7725, lng: 106.6980, area: 'Chợ Bến Thành, TP. Hồ Chí Minh' };
const places = [
  {
    name: 'Propaganda Vietnamese Bistro', address: '21 Hàn Thuyên, TP. Hồ Chí Minh',
    lat: 10.77878, lng: 106.69816, recipe: 'rolls', dish: 'Fresh shrimp and vegetable rolls',
    menu: 'https://propagandabistros.com/wp-content/uploads/2023/12/food-menu-pp-190423-ol.pdf'
  },
  {
    name: 'Bếp Cuốn Sài Gòn', address: '76 Võ Văn Tần, TP. Hồ Chí Minh',
    lat: 10.7765904, lng: 106.6900581, recipe: 'rolls', dish: 'Fresh shrimp rolls',
    menu: 'https://bepcuon.net/thuc-don/'
  },
  {
    name: 'A Taste of Saigon – Old Market', address: '42/6B Tôn Thất Thiệp, TP. Hồ Chí Minh',
    lat: 10.7738453, lng: 106.7021775, recipe: 'rolls', dish: 'Fresh shrimp and pork rolls',
    menu: 'https://atasteofsaigon.vn/wp-content/uploads/2025/07/Old-Market-FOOD-MENU.pdf'
  },
  {
    name: 'Secret Garden – Lê Công Kiều', address: '19 Lê Công Kiều, TP. Hồ Chí Minh',
    lat: 10.7703653, lng: 106.6996626, recipe: 'rolls', dish: 'Fresh rolls',
    source: 'https://secretgardensaigon.com/'
  }
];

export function isPoint(point) {
  return Number.isFinite(point?.lat) && Math.abs(point.lat) <= 90
    && Number.isFinite(point?.lng) && Math.abs(point.lng) <= 180;
}

export function manualArea(value) {
  const area = value.trim().replace(/\s+/g, ' ');
  if (!area) return null;
  if (/^(cho )?ben thanh( market)?$/i.test(area.normalize('NFD').replace(/\p{M}/gu, ''))) return benThanh;
  const coordinate = area.match(/^([+-]?\d+(?:\.\d+)?)[,;]\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!coordinate) return { area };
  const point = { lat: Number(coordinate[1]), lng: Number(coordinate[2]) };
  return isPoint(point) ? point : null;
}

export function distanceKm(from, to) {
  const radians = value => value * Math.PI / 180;
  const arc = Math.sin(radians(to.lat - from.lat) / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat))
    * Math.sin(radians(to.lng - from.lng) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, arc)));
}

export function nearbyPlaces(recipeId, origin) {
  if (!isPoint(origin)) return [];
  const margin = (origin.accuracy ?? 0) / 1000;
  return places.filter(place => place.recipe === recipeId)
    .map(place => ({ ...place, km: distanceKm(origin, place) }))
    .filter(place => place.km + margin <= nearbyRadiusKm)
    .sort((a, b) => Number(Boolean(b.menu)) - Number(Boolean(a.menu)) || a.km - b.km)
    .slice(0, 5);
}

export function nearbyAlternatives({ selected, servings, target, vegetarian, profile, origin }) {
  const ranked = recipes
    .filter(recipe => recipe.id !== selected && (!vegetarian || recipe.vegetarian))
    .map(recipe => {
      const portions = servingOptions.map(portion => {
        const kcal = calories(recipe, portion);
        return { portion, kcal, difference: Math.abs(kcal - target) / target };
      });
      const best = portions.sort((a, b) => a.difference - b.difference
        || Math.abs(a.portion - servings) - Math.abs(b.portion - servings))[0];
      return {
        recipe, ...best, confirmed: nearbyPlaces(recipe.id, origin).some(place => place.menu),
        fit: best.difference <= 0.1 ? best.difference * target - mealPreferenceScore(recipe, profile) : best.difference * target
      };
    })
    .sort((a, b) => Number(b.difference <= 0.1) - Number(a.difference <= 0.1)
      || Number(b.confirmed) - Number(a.confirmed) || a.fit - b.fit)
  const close = ranked.filter(option => option.difference <= 0.1);
  return close.length ? close.slice(0, 3) : ranked.sort((a, b) => a.fit - b.fit).slice(0, 1);
}

export function nearbySearchUrl(recipe, origin, language, vegetarian) {
  const vietnamese = language === 'vi' || (isPoint(origin)
    && Math.abs(origin.lat - benThanh.lat) < 0.5 && Math.abs(origin.lng - benThanh.lng) < 0.5);
  const queries = {
    lemongrass: 'cơm gà sả', pasta: 'mì Ý penne sốt cà chua', soba: 'mì soba đậu phụ',
    salmon: 'cá hồi khoai tây', rolls: 'gỏi cuốn tôm', chickpea: 'salad đậu gà'
  };
  const dish = vietnamese ? queries[recipe.id] : recipe.name;
  const area = origin?.area || (isPoint(origin) ? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}` : '');
  const diet = vegetarian ? { vi: 'chay', en: 'vegetarian', es: 'vegetariano', fr: 'végétarien' }[vietnamese ? 'vi' : language] : '';
  return mapsUrl([dish, diet, area].filter(Boolean).join(' '));
}
