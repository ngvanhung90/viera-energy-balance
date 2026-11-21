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
