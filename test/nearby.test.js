import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recipes } from '../public/src/catalog.js';
import { calories, mapsUrl, preferences } from '../public/src/planner.js';
import { benThanh, deviceSearchPoint, distanceKm, manualArea, nearbyAlternatives, nearbyPlaces, nearbySearchUrl } from '../public/src/nearby.js';
import { findAreas, findPossiblePlaces } from '../public/src/nearby-discovery.js';

test('Bến Thành lists verified menu items ahead of possible matches', () => {
  const places = nearbyPlaces('rolls', manualArea('Chợ Bến Thành'));
  assert.equal(places.length, 4);
  assert.deepEqual(places.map(place => Boolean(place.menu)), [true, true, true, false]);
  assert.ok(places.every(place => place.km > 0 && place.km <= 5));
  assert.equal(places[0].name, 'A Taste of Saigon – Old Market');
  assert.equal(places[0].dish, 'Fresh shrimp and pork rolls');
  assert.deepEqual(nearbyPlaces('soba', benThanh), []);
});

test('the radius follows the selected point and excludes uncertain outer matches', () => {
  assert.deepEqual(nearbyPlaces('rolls', manualArea('21.03, 105.85')), []);
  assert.deepEqual(nearbyPlaces('rolls', { ...benThanh, accuracy: 4999 }), []);
  assert.deepEqual(nearbyPlaces('rolls', manualArea('Paris, France')), []);
  assert.equal(manualArea('91,106.7'), null);
  assert.equal(manualArea(''), null);
  assert.ok(distanceKm({ lat: 0, lng: 179.99 }, { lat: 0, lng: -179.99 }) < 3);
});

test('device location keeps an opted-in precise fix local and rounds approximate choices', () => {
  const fix = { lat: 48.858262, lng: 2.340145, accuracy: 12, precise: true };
  assert.deepEqual(deviceSearchPoint(fix, true), fix);
  const approximate = deviceSearchPoint(fix, false);
  assert.deepEqual(approximate, { lat: 48.86, lng: 2.34, accuracy: 1000, precise: false });
  assert.deepEqual(deviceSearchPoint({ ...fix, precise: false }, true), approximate);
  assert.equal(deviceSearchPoint({ ...fix, accuracy: -1 }, true), null);
  const names = point => nearbyPlaces('pasta', point).map(place => place.name);
  assert.ok(names(fix).includes('Amalfitana'));
  assert.ok(!names(approximate).includes('Amalfitana'));
  const pasta = recipes.find(recipe => recipe.id === 'pasta');
  const query = new URL(nearbySearchUrl(pasta, fix, 'en', false)).searchParams.get('query');
  assert.ok(query.endsWith('48.86,2.34'));
  assert.ok(!query.includes('48.858262'));
});

test('alternatives respect the energy target, portions, favorites and vegetarian filter', () => {
  const query = { selected: 'chickpea', servings: 1, target: 360, vegetarian: false, profile: preferences, origin: benThanh };
  const [rolls] = nearbyAlternatives(query);
  assert.equal(rolls.recipe.id, 'rolls');
  assert.equal(rolls.kcal, 350);
  assert.ok(rolls.confirmed && rolls.difference <= 0.1);
  assert.equal(nearbyAlternatives(query).length, 1);

  const vegetarian = { ...query, selected: 'rolls', target: 750, vegetarian: true };
  const options = nearbyAlternatives(vegetarian);
  assert.ok(options.every(option => option.recipe.vegetarian && option.difference <= 0.1));
  assert.equal(options[0].portion, 1.5);
  assert.equal(options[0].kcal, calories(options[0].recipe, options[0].portion));
  const preferred = nearbyAlternatives({
    ...vegetarian, profile: { ...preferences, cuisine: 'European', taste: 'Herby', favorites: ['pasta'] }
  });
  assert.equal(preferred[0].recipe.id, 'pasta');
  assert.ok(nearbyAlternatives({ ...vegetarian, target: 2000 })[0].difference > 0.1);
});

test('Maps search encodes the selected dish and area; directions contain only the destination', () => {
  const rolls = recipes.find(recipe => recipe.id === 'rolls');
  const search = new URL(nearbySearchUrl(rolls, manualArea('Chợ Bến Thành'), 'en', false));
  assert.equal(search.origin, 'https://www.google.com');
  assert.equal(search.pathname, '/maps/search/');
  assert.equal(search.searchParams.get('query'), 'gỏi cuốn tôm Chợ Bến Thành, TP. Hồ Chí Minh');
  const directions = new URL(mapsUrl('10.7738453,106.7021775', true));
  assert.equal(directions.pathname, '/maps/dir/');
  assert.deepEqual([...directions.searchParams.keys()], ['api', 'destination']);
});

test('open map discovery limits coordinates sent and omits venues outside the true radius', async () => {
  const origin = { lat: 48.857514, lng: 2.351513 };
  const point = (name, id, coordinates, osmValue = 'restaurant') => ({
    type: 'Feature', geometry: { type: 'Point', coordinates },
    properties: { name, city: 'Paris', osm_key: 'amenity', osm_value: osmValue, osm_type: 'N', osm_id: id }
  });
  const request = async (url, init) => {
    const lookup = new URL(url);
    assert.equal(lookup.origin, 'https://photon.komoot.io');
    assert.equal(lookup.searchParams.get('lat'), '48.86');
    assert.equal(lookup.searchParams.get('lon'), '2.35');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.ok(lookup.searchParams.has('bbox'));
    return Response.json({ type: 'FeatureCollection', features: [
      point('Pasta Linea', 3685624331, [2.364, 48.855], 'fast_food'),
      point('Pasta Linea', 3685624331, [2.364, 48.855], 'fast_food'),
      point('Pasta outside radius', 10, [2.351513, 48.903]),
      point('Sola', 5132850848, [2.35, 48.85]),
      point('Pasta hospital', 11, [2.35, 48.85], 'hospital')
    ] });
  };
  const venues = await findPossiblePlaces('pasta', origin, new AbortController().signal, request);
  assert.equal(venues.length, 1);
  assert.equal(venues[0].name, 'Pasta Linea');
  assert.ok(venues[0].km <= 5 && !venues[0].menu);
  assert.equal(venues[0].source, 'https://www.openstreetmap.org/node/3685624331');
});

test('returns geocoded candidate points and rejects service errors', async () => {
  const control = new AbortController();
  const areas = await findAreas('Paris Hôtel de Ville', control.signal, async (url, init) => {
    assert.equal(new URL(url).searchParams.get('q'), 'Paris Hôtel de Ville');
    assert.equal(init.cache, 'no-store');
    return Response.json({ type: 'FeatureCollection', features: [{
      type: 'Feature', geometry: { type: 'Point', coordinates: [2.352, 48.857] },
      properties: { name: 'Hôtel de ville', city: 'Paris', country: 'France' }
    }] });
  });
  assert.deepEqual(areas, [{ lat: 48.857, lng: 2.352, area: 'Hôtel de ville, Paris, France', openData: true }]);
  await assert.rejects(findAreas('Paris', control.signal, async () => new Response(null, { status: 503 })), /lookup-unavailable/);
  assert.deepEqual(nearbyPlaces('pasta', areas[0]).map(place => place.name), ['Don Giovanni', 'Amalfi']);
  assert.ok(nearbyPlaces('pasta', { lat: 48.858, lng: 2.34 }).some(place => place.name === 'Amalfitana'));
});
