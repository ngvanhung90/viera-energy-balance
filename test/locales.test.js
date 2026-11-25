import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes, workouts } from '../public/src/catalog.js';
import { displayActivity, displayMeal } from '../public/src/catalog-locales.js';
import { chooseLanguage } from '../public/src/locales.js';
import { calories, mealMatches, preferences } from '../public/src/planner.js';

test('locale selection uses the first supported phone setting and falls back to English', () => {
  assert.equal(chooseLanguage(['vi-VN', 'en-US']), 'vi');
  assert.equal(chooseLanguage(['de-DE', 'fr-CA', 'en-GB']), 'fr');
  assert.equal(chooseLanguage(['es-MX']), 'es');
  assert.equal(chooseLanguage(['ja-JP']), 'en');
});

test('planner explanations and home accessibility labels use the selected Android language', async () => {
  const messages = [
    'These picks fit the time and equipment you selected.',
    'The meal choice considers your per-plate estimate.',
    'The pairing considers the preferences used for this run.',
    'Viera Energy Balance home',
    'Illustration of a lemongrass chicken and rice bowl with herbs'
  ];
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    for (const tag of ['vi-VN', 'es-MX', 'fr-CA', 'en-US']) {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { userAgent: `VieraLocale/${tag}` }
      });
      const { t } = await import(`../public/src/locales.js?locale=${tag}`);
      for (const message of messages) {
        if (tag === 'en-US') assert.equal(t(message), message);
        else assert.notEqual(t(message), message, `${tag}: ${message}`);
      }
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});

test('localized ingredients are searchable without changing calories or recipe and workout IDs', () => {
  const meal = recipes.find(item => item.id === 'soba');
  const workout = workouts.find(item => item.id === 'walk');
  for (const language of ['vi', 'es', 'fr']) {
    const local = displayMeal(meal, language);
    assert.equal(local.ingredients.length, meal.ingredients.length);
    assert.equal(local.steps.length, meal.steps.length);
    assert.equal(calories(local, 1.5), calories(meal, 1.5));
    assert.equal(displayActivity(workout, language).id, workout.id);
  }
  assert.equal(mealMatches({ target: 500, cuisine: 'Any', search: 'đậu phụ' }, preferences,
    item => displayMeal(item, 'vi'))[0]?.id, meal.id);
});
