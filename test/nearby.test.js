import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recipes } from '../public/src/catalog.js';
import { calories, mapsUrl, preferences } from '../public/src/planner.js';
import { benThanh, distanceKm, manualArea, nearbyAlternatives, nearbyPlaces, nearbySearchUrl } from '../public/src/nearby.js';

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
