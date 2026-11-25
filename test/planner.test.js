import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipes, workouts } from '../public/src/catalog.js';
import {
  activityCalories, activityOptions, calories, habitPlan, makePlanPrompt, mapsUrl, mealMatches,
  planOptions, preferences, validateChoices, validateNanoChoices
} from '../public/src/planner.js';
import { failureCode, generatePlan } from '../public/src/ai.js';
import { freshState, readState, recordCompletion, saveState } from '../public/src/storage.js';

const filters = { target: 500, cuisine: 'Any', scenario: 'regular', vegetarian: false };

test('all catalog meals and movements satisfy the published portion, time and effort constraints', () => {
  assert.equal(recipes.length, 12);
  assert.equal(workouts.length, 7);
  for (const recipe of recipes) {
    const amounts = [0.5, 1, 1.5, 2, 3].map(servings => calories(recipe, servings));
    assert.ok(amounts.every((amount, i) => amount > (amounts[i - 1] ?? 0)), recipe.id);
    assert.ok(recipe.ingredients.length && recipe.steps.length, recipe.id);
    const options = { target: amounts[1], cuisine: recipe.cuisine, mealMinutes: recipe.minutes };
    assert.ok(mealMatches(options, preferences).includes(recipe), recipe.id);
    assert.ok(!mealMatches({ ...options, mealMinutes: recipe.minutes - 1 }, preferences).includes(recipe), recipe.id);
    assert.equal(mealMatches({ ...options, vegetarian: true }, preferences).includes(recipe), recipe.vegetarian);
  }
  for (const workout of workouts) {
    const profile = { ...preferences, intensity: workout.intensity, equipment: workout.equipment };
    assert.ok(activityOptions(profile, workout.minutes).includes(workout), workout.id);
    assert.ok(!activityOptions(profile, workout.minutes - 1).includes(workout), workout.id);
    assert.equal(activityOptions({ ...profile, lowImpact: true }).includes(workout), workout.lowImpact);
    assert.equal(activityOptions({ ...profile, equipment: 'None' }).includes(workout), workout.equipment === 'None');
    assert.ok(activityCalories(workout, 100) > activityCalories(workout, 70), workout.id);
  }
});

test('completed history can change local ordering without weakening a diet or equipment filter', () => {
  const meals = { target: 500, cuisine: 'Any', vegetarian: true };
  const secondMeal = mealMatches(meals, preferences).find(recipe => recipe.id === 'yogurt-oats');
  const mealWithHistory = { ...preferences, completedMeals: [secondMeal.id, 'rolls'] };
  const before = mealMatches(meals, preferences);
  const after = mealMatches(meals, mealWithHistory);
  assert.deepEqual(after.map(recipe => recipe.id).sort(), before.map(recipe => recipe.id).sort());
  assert.notEqual(after.indexOf(secondMeal), before.indexOf(secondMeal));
  const activity = { ...preferences, completedWorkouts: ['cardio', 'cycle'], equipment: 'None' };
  assert.equal(activityOptions(activity)[0].id, 'cardio');
  assert.ok(!activityOptions(activity).some(workout => workout.id === 'cycle'));
});

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
  assert.ok(gentle.movementOptions.some(item => item.id === 'stretch'));
  assert.ok(gentle.movementOptions.some(item => item.id === 'yoga'));
  assert.ok(gentle.movementOptions.every(item => item.intensity === 'Gentle'));
});

test('diet, time, equipment, impact, and weight hold in the local planner', () => {
  const profile = { ...preferences, activityMinutes: 15, equipment: 'None', lowImpact: true,
    activityTarget: 45, bodyWeight: 100, favorites: [], favoriteWorkouts: ['yoga'] };
  const options = planOptions({ ...filters, vegetarian: true }, profile);
  assert.deepEqual(activityOptions(profile).map(item => item.id), ['yoga', 'cardio']);
  assert.ok(options.movementOptions.every(item => item.minutes <= 15 && item.equipment === 'None' && item.lowImpact));
  assert.ok(options.mealOptions.every(item => item.vegetarian));
  assert.equal(activityCalories(workouts.find(item => item.id === 'walk'), 100), 135);
  assert.equal(activityCalories(workouts.find(item => item.id === 'walk'), null), 95);
  assert.doesNotMatch(makePlanPrompt(options, profile), /bodyWeight|activityTarget|completedWorkouts|completedMeals/);
  assert.ok(mealMatches({ ...filters, vegetarian: true, mealMinutes: 15 }, profile)
    .every(meal => meal.vegetarian && meal.minutes <= 15));
});

test('completed plans and private defaults survive save and reopen safely', () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  try {
    const state = freshState();
    state.profile.bodyWeight = 83.5;
    state.profile.activityTarget = 130;
    state.plan = { meal: 'lentil-salad', workout: 'yoga', mealPath: 'buy', source: 'catalog', servings: 1.5 };
    const day = new Date(2026, 10, 24, 8);
    assert.ok(recordCompletion(state, day));
    assert.equal(recordCompletion(state, day), false);
    assert.ok(saveState(state));
    const reopened = readState();
    assert.deepEqual(reopened.plan, state.plan);
    assert.deepEqual(reopened.completed, state.completed);
    assert.equal(reopened.profile.bodyWeight, 83.5);
    assert.equal(reopened.profile.activityTarget, 130);
    assert.equal(reopened.completed[0].day, '2026-11-24');
  } finally { globalThis.localStorage = previous; }
});

test('generated choices must be valid for the current constraints', () => {
  const options = planOptions({ ...filters, scenario: 'noCook' }, preferences);
  assert.equal(validateChoices('{"meal":"rolls","workout":"walk","focus":"time"}', options).meal.id, 'rolls');
  assert.throws(() => validateChoices('{"meal":"pasta","workout":"walk","focus":"time"}', options), /invalid-selection/);
  assert.throws(() => validateChoices('{"meal":"rolls","workout":"jog","focus":"time"}', options), /invalid-selection/);
  assert.throws(() => validateChoices('plain text', options), /invalid-selection/);
  assert.doesNotMatch(makePlanPrompt(options, { ...preferences, goal: 'Lose', change: 4.5 }), /4\.5|Lose/);
});

test('Nano accepts one JSON pairing and applies the unchanged planner validator', () => {
  const options = planOptions({ ...filters, scenario: 'noCook' }, preferences);
  const valid = '{"meal":"rolls","workout":"walk","focus":"time"}';
  for (const response of [valid, `\`\`\`json\n${valid}\n\`\`\``, `\`\`\`\r\n${valid}\r\n\`\`\``]) {
    assert.equal(validateNanoChoices(response, options).meal.id, 'rolls');
  }
  for (const response of [
    `${valid}\n${valid}`, `My recommendation is ${valid}`, `\`\`\`json\n${valid}`,
    `${valid.slice(0, -1)},"notes":"extra"}`, `[${valid}]`, valid.slice(0, -1),
    valid.replace('rolls', 'unknown-dish'), valid.replace('rolls', 'pasta'),
    valid.replace('walk', 'jog'), valid.replace('time', 'invented'), ' '.repeat(2049)
  ]) {
    assert.throws(() => validateNanoChoices(response, options), /invalid-selection/);
  }
  const vegetarian = planOptions({ ...filters, vegetarian: true }, preferences);
  assert.throws(() => validateNanoChoices(valid, vegetarian), /invalid-selection/);
  const gentle = planOptions(filters, { ...preferences, intensity: 'Gentle' });
  assert.throws(() => validateNanoChoices(valid, gentle), /invalid-selection/);
});

test('Android Nano bridge requires explicit download and inference source checks', async t => {
  const browser = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'VieraAndroid/1' } });
  const bridge = new EventTarget();
  const operations = [];
  let status = { availability: 'downloadable', liveAvailable: false, modelDownload: {} };
  let generated = { source: 'IN_CLOUD', text: '{"meal":"rolls","workout":"walk","focus":"time"}' };
  bridge.postMessage = message => {
    const { id, operation, ...details } = JSON.parse(message);
    operations.push({ operation, ...details });
    const response = operation === 'status' ? status : operation === 'generate' ? generated : {};
    if (operation === 'generate' && details.branch !== 'device') assert.fail('Cloud call without consent');
    queueMicrotask(() => bridge.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id, ...response }) })));
  };
  globalThis.VieraNative = bridge;
  t.after(() => {
    delete globalThis.VieraNative;
    if (browser) Object.defineProperty(globalThis, 'navigator', browser);
    else delete globalThis.navigator;
  });
  const ai = await import('../public/src/ai.js?android-nano-test');
  assert.equal(await ai.checkDevice(), 'downloadable');
  assert.equal(ai.liveAvailable(), false);
  await assert.rejects(ai.startNanoDownload(false));
  assert.deepEqual(operations, [{ operation: 'status' }]);
  await ai.startNanoDownload(true);
  assert.deepEqual(operations.at(-1), { operation: 'download-nano', confirmed: true });
  status = { ...status, availability: 'downloading', modelDownload: { totalBytes: 100, downloadedBytes: 60 } };
  assert.equal(await ai.checkDevice(), 'downloading');
  assert.equal(ai.nanoDownloadStatus().downloadedBytes, 60);
  await assert.rejects(ai.startNanoDownload(true));
  status = { ...status, availability: 'unavailable' };
  assert.equal(await ai.checkDevice(), 'unavailable');
  await assert.rejects(ai.startNanoDownload(true));
  status = { ...status, availability: 'available' };
  const input = { mode: 'auto', options: planOptions({ ...filters, scenario: 'noCook' }, preferences),
    profile: preferences, availability: await ai.checkDevice(), allowCloud: false };
  assert.equal((await ai.generatePlan(input)).reason, 'unexpected-source');
  generated = { ...generated, source: 'ON_DEVICE', text: `\`\`\`json\n${generated.text}\n\`\`\`` };
  assert.equal((await ai.generatePlan(input)).source, 'device');
  generated = { ...generated, text: 'something else' };
  assert.equal((await ai.generatePlan(input)).reason, 'invalid-selection');
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
  assert.equal(failureCode(new Error('device-quota')), 'device-quota');
  assert.deepEqual(await generatePlan({ mode: 'rules', allowCloud: true }), { source: 'catalog' });
});

test('saved selections retain servings and source and can read older plans', t => {
  const local = new Map();
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => local.get(key), setItem: (key, value) => local.set(key, value) }
  });
  t.after(() => {
    if (existing) Object.defineProperty(globalThis, 'localStorage', existing);
    else delete globalThis.localStorage;
  });
  saveState({ profile: {}, plan: { meal: 'soba', workout: 'walk' } });
  assert.deepEqual(readState().plan, { meal: 'soba', workout: 'walk', servings: 1, source: 'saved' });
  const plan = { meal: 'soba', workout: 'walk', servings: 1.5, source: 'manual' };
  assert.equal(saveState({ profile: {}, plan }), true);
  assert.deepEqual(readState().plan, plan);
});
