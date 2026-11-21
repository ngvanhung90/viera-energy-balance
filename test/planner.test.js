import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipes, workouts } from '../public/src/catalog.js';
import {
  activityCalories, calories, habitPlan, makePlanPrompt, mapsUrl, mealMatches,
  planOptions, preferences, validateChoices
} from '../public/src/planner.js';
import { failureCode, generatePlan } from '../public/src/ai.js';

const filters = { target: 500, cuisine: 'Any', scenario: 'regular', vegetarian: false };

test('servings scale calories from the ingredient list', () => {
  assert.equal(calories(recipes[0]), 505);
  assert.ok(Math.abs(calories(recipes[0], 2) - 2 * calories(recipes[0])) <= 5);
  assert.ok(activityCalories(workouts[1]) > activityCalories(workouts[0]));
});

test('dish search, cuisine and saved favorites work together', () => {
  const profile = { ...preferences, favorites: ['soba'] };
  const query = { ...filters, cuisine: 'Asian', search: 'tofu', favoritesOnly: true };
  assert.deepEqual(mealMatches(query, profile).map(item => item.id), ['soba']);
  assert.deepEqual(mealMatches({ ...query, cuisine: 'European' }, profile), []);
});

test('day constraints and effort cap survive suggestions', () => {
  const quick = planOptions({ ...filters, scenario: 'late', vegetarian: true }, preferences);
  assert.ok(quick.mealOptions.length >= 2);
  assert.ok(quick.mealOptions.every(recipe => recipe.vegetarian && recipe.minutes <= 25));
  const noStove = planOptions({ ...filters, scenario: 'noCook' }, preferences);
  assert.deepEqual(noStove.mealOptions.map(item => item.id), ['rolls']);
  const gentle = planOptions(filters, { ...preferences, intensity: 'Gentle' });
  assert.deepEqual(gentle.movementOptions.map(item => item.id), ['stretch']);
});

test('generated choices must be valid for the current constraints', () => {
  const options = planOptions({ ...filters, scenario: 'noCook' }, preferences);
  assert.equal(validateChoices('{"meal":"rolls","workout":"walk","focus":"time"}', options).meal.id, 'rolls');
  assert.throws(() => validateChoices('{"meal":"pasta","workout":"walk","focus":"time"}', options), /invalid-selection/);
  assert.throws(() => validateChoices('{"meal":"rolls","workout":"jog","focus":"time"}', options), /invalid-selection/);
  assert.throws(() => validateChoices('plain text', options), /invalid-selection/);
  assert.doesNotMatch(makePlanPrompt(options, { ...preferences, goal: 'Lose', change: 4.5 }), /4\.5|Lose/);
});

test('weight goal bounds and directions handoff are explicit', () => {
  assert.match(habitPlan('Gain', 2).title, /\+2 kg/);
  assert.equal(habitPlan('Lose', 6), null);
  assert.equal(new URL(mapsUrl('Bến Thành', true)).searchParams.get('destination'), 'Bến Thành');
});

test('missing config stays in the catalog and error categories remain distinct', async () => {
  const options = planOptions(filters, preferences);
  const reply = await generatePlan({ mode: 'device', options, profile: preferences, availability: 'available' });
  assert.deepEqual(reply, { source: 'catalog', reason: 'firebase-config-missing' });
  assert.equal(failureCode({ customData: { status: 429 } }), 'quota');
  assert.equal(failureCode(new Error('Firebase 403 PERMISSION_DENIED')), 'app-check');
  assert.equal(failureCode(new Error('Failed to fetch')), 'offline');
  assert.equal(failureCode(new Error('deadline')), 'deadline');
});
