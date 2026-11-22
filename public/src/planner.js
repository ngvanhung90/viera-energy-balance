import { recipes, workouts } from './catalog.js';

export const preferences = {
  cuisine: 'Any', taste: 'Any', intensity: 'Moderate', movement: 'Any',
  goal: 'Maintain', change: 0, favorites: [], favoriteWorkouts: []
};

export const scenarios = {
  regular: { label: 'A regular evening', mealMinutes: 40, activityMinutes: 30, noCook: false },
  late: { label: 'Only 25 minutes', mealMinutes: 25, activityMinutes: 20, noCook: false },
  noCook: { label: 'No stove tonight', mealMinutes: 20, activityMinutes: 20, noCook: true },
  gentle: { label: 'A low-energy day', mealMinutes: 25, activityMinutes: 10, noCook: false }
};

export function calories(recipe, servings = 1) {
  const energy = recipe.ingredients.reduce((total, item) => total + item.grams * item.kcalPer100 / 100, 0);
  return Math.round(energy * servings / 5) * 5;
}

export function activityCalories(workout, weight = 70) {
  return Math.round(workout.met * 3.5 * weight / 200 * workout.minutes / 5) * 5;
}

export function mealPreferenceScore(recipe, profile) {
  return (profile.favorites.includes(recipe.id) ? 30 : 0)
    + (profile.taste !== 'Any' && recipe.tastes.includes(profile.taste) ? 18 : 0)
    + (recipe.cuisine === profile.cuisine ? 12 : 0);
}

export function mealMatches({ target, cuisine, search = '', favoritesOnly = false }, profile, display = value => value) {
  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return recipes.filter(recipe => {
    const localized = display(recipe);
    const searchable = [recipe.name, recipe.origin, recipe.cuisine, ...recipe.ingredients.map(item => item.name),
      localized.name, ...localized.ingredients.map(item => item.name)]
      .join(' ').toLowerCase();
    return (cuisine === 'Any' || recipe.cuisine === cuisine)
      && (!favoritesOnly || profile.favorites.includes(recipe.id))
      && words.every(word => searchable.includes(word));
  }).sort((first, second) => {
    const score = recipe => Math.abs(calories(recipe) - target) - mealPreferenceScore(recipe, profile);
    return score(first) - score(second);
  });
}

export function planOptions({ target, cuisine, vegetarian, scenario }, profile) {
  const limits = scenarios[scenario] ?? scenarios.regular;
  const mealOptions = mealMatches({ target, cuisine }, profile).filter(recipe =>
    recipe.minutes <= limits.mealMinutes
      && (!limits.noCook || recipe.id === 'rolls')
      && (!vegetarian || recipe.vegetarian));
  const intensities = ['Gentle', 'Moderate', 'Vigorous'];
  const maximum = intensities.indexOf(profile.intensity);
  const movementOptions = workouts.filter(workout =>
    workout.minutes <= limits.activityMinutes && intensities.indexOf(workout.intensity) <= maximum
  ).sort((first, second) => {
    const score = workout => (profile.favoriteWorkouts.includes(workout.id) ? 3 : 0)
      + (workout.style === profile.movement ? 2 : 0)
      + (workout.intensity === profile.intensity ? 1 : 0);
    return score(second) - score(first);
  });
  return { mealOptions, movementOptions, target, scenario, limits, vegetarian };
}

// Only structured choices from the supplied catalog are accepted, including the rationale.
// Recipes, estimated energy and workout instructions always come from the catalog.
export function validateChoices(response, options) {
  let selection;
  try {
    selection = JSON.parse(response);
  } catch {
    throw new Error('invalid-selection');
  }
  const meal = options.mealOptions.find(recipe => recipe.id === selection?.meal);
  const workout = options.movementOptions.find(item => item.id === selection?.workout);
  const focus = selection?.focus;
  const validFocus = ['time', 'energy', 'taste'].includes(focus);
  if (!meal || !workout || !validFocus) throw new Error('invalid-selection');
  return { meal, workout, focus };
}

export function makePlanPrompt(options, profile) {
  const meals = options.mealOptions.map(recipe => ({
    id: recipe.id, name: recipe.name, cuisine: recipe.cuisine, kcal: calories(recipe),
    minutes: recipe.minutes, tastes: recipe.tastes, liked: profile.favorites.includes(recipe.id)
  }));
  const movement = options.movementOptions.map(workout => ({
    id: workout.id, style: workout.style, minutes: workout.minutes, intensity: workout.intensity,
    liked: profile.favoriteWorkouts.includes(workout.id)
  }));
  return [
    'Choose one dinner and one independent movement option from the supplied catalog for a synthetic adult demo.',
    'Balance meal energy match, time and favorite tastes. Do not frame movement as compensation for food.',
    'Return a single JSON object with exactly three string keys: meal (catalog id), workout (catalog id), focus (time, energy or taste).',
    JSON.stringify({
      scenario: options.limits.label, targetMealKcal: options.target, preferredTaste: profile.taste,
      preferredCuisine: profile.cuisine, preferredMovement: profile.movement, meals, movement
    })
  ].join('\n');
}

export function habitPlan(goal, change) {
  if (goal === 'Maintain') {
    return {
      title: 'Build a repeatable rhythm',
      weeks: ['Pick two dinners you enjoy and can repeat.', 'Pick movement you look forward to and fit it into your week.', 'Review what felt sustainable. Keep the habits that fit.']
    };
  }
  if (!['Gain', 'Lose'].includes(goal) || !Number.isFinite(change) || change < 0.5 || change > 5) return null;
  const gain = goal === 'Gain';
  return {
    title: `${gain ? '+' : '−'}${change} kg · a goal to review`,
    weeks: [
      'Observe your regular meals, movement and energy for a week. Choose one habit you can keep.',
      gain
        ? 'Plan regular meals and a convenient snack if you need one. Build in activity you enjoy and recovery time.'
        : 'Plan repeatable meals, keep portions flexible and add movement that fits your schedule.',
      'Review how you feel and how the habit is going. Revisit the goal without forcing a deadline or calorie change.'
    ]
  };
}

export function mapsUrl(query, directions = false) {
  const route = directions ? 'dir' : 'search';
  const params = new URLSearchParams({ api: '1', [directions ? 'destination' : 'query']: query });
  return `https://www.google.com/maps/${route}/?${params}`;
}
