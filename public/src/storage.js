import { recipes, workouts } from './catalog.js';
import { preferences } from './planner.js';

const key = 'viera-energy-v1';
export const servingOptions = [0.5, 1, 1.5, 2, 3];
const planSources = ['device', 'cloud', 'catalog', 'manual'];
const choices = {
  cuisine: ['Any', 'Asian', 'European'], taste: ['Any', 'Savory', 'Herby', 'Crunchy', 'Cozy'],
  intensity: ['Gentle', 'Moderate', 'Vigorous'], movement: ['Any', 'Mobility', 'Walking', 'Cycling', 'Running', 'Yoga', 'Strength', 'Cardio'],
  equipment: ['Any', 'None', 'Chair', 'Bicycle'],
  goal: ['Maintain', 'Gain', 'Lose']
};

export function freshState() {
  return { profile: { ...preferences, favorites: [], favoriteWorkouts: [] }, plan: null, checked: {}, completed: [] };
}

function readPlan(plan) {
  if (!recipes.some(item => item.id === plan?.meal) || !workouts.some(item => item.id === plan?.workout)) return null;
  const { meal, workout, servings, source, mealPath, target, vegetarian } = plan;
  return {
    meal, workout, servings: servingOptions.includes(servings) ? servings : 1,
    source: planSources.includes(source) ? source : 'saved',
    ...(mealPath === 'cook' || mealPath === 'buy' ? { mealPath } : {}),
    ...(Number.isFinite(target) && target >= 200 && target <= 1000 ? { target } : {}),
    ...(typeof vegetarian === 'boolean' ? { vegetarian } : {})
  };
}

export function recordCompletion(state, at = new Date()) {
  const plan = readPlan(state.plan);
  if (!plan) return false;
  const day = [at.getFullYear(), at.getMonth() + 1, at.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-');
  if (state.completed.some(item => item.day === day && item.meal === plan.meal && item.workout === plan.workout)) return false;
  state.completed = [{ ...plan, day }, ...state.completed].slice(0, 30);
  return true;
}

export function normalizeCompletedPlans(completed) {
  return Array.isArray(completed) ? completed.slice(0, 30).flatMap(entry => {
    const plan = readPlan(entry);
    return plan && typeof entry.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.day) ? [{ ...plan, day: entry.day }] : [];
  }) : [];
}

export function readState() {
  const state = freshState();
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (!raw?.profile) return state;
    for (const [property, allowed] of Object.entries(choices)) {
      if (allowed.includes(raw.profile[property])) state.profile[property] = raw.profile[property];
    }
    const change = raw.profile.change;
    if (typeof change === 'number' && change >= 0.5 && change <= 5) state.profile.change = change;
    const { bodyWeight, activityMinutes, lowImpact, activityTarget } = raw.profile;
    if (Number.isFinite(bodyWeight) && bodyWeight >= 30 && bodyWeight <= 300) state.profile.bodyWeight = bodyWeight;
    if ([10, 15, 20, 25, 30].includes(activityMinutes)) state.profile.activityMinutes = activityMinutes;
    state.profile.lowImpact = lowImpact === true;
    if (Number.isInteger(activityTarget) && activityTarget >= 20 && activityTarget <= 500) state.profile.activityTarget = activityTarget;
    if (Array.isArray(raw.profile.favorites)) {
      state.profile.favorites = recipes.map(item => item.id).filter(id => raw.profile.favorites.includes(id));
    }
    if (Array.isArray(raw.profile.favoriteWorkouts)) {
      state.profile.favoriteWorkouts = workouts.map(item => item.id).filter(id => raw.profile.favoriteWorkouts.includes(id));
    }
    state.plan = readPlan(raw.plan);
    state.completed = normalizeCompletedPlans(raw.completed);
    for (const recipe of recipes) {
      const indexes = raw.checked?.[recipe.id];
      if (Array.isArray(indexes)) {
        state.checked[recipe.id] = indexes.filter(index => Number.isInteger(index) && index >= 0 && index < recipe.ingredients.length);
      }
    }
  } catch {
    // A disabled or corrupt store still permits using the app in this session.
  }
  return state;
}

export function saveState(state) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
