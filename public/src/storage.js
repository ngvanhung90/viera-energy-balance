import { recipes, workouts } from './catalog.js';
import { preferences } from './planner.js';

const key = 'viera-energy-v1';
export const servingOptions = [0.5, 1, 1.5, 2, 3];
const planSources = ['device', 'cloud', 'catalog', 'manual'];
const choices = {
  cuisine: ['Any', 'Asian', 'European'], taste: ['Any', 'Savory', 'Herby', 'Crunchy', 'Cozy'],
  intensity: ['Gentle', 'Moderate', 'Vigorous'], movement: ['Any', 'Mobility', 'Walking', 'Cycling', 'Running'],
  goal: ['Maintain', 'Gain', 'Lose']
};

export function freshState() {
  return { profile: { ...preferences, favorites: [], favoriteWorkouts: [] }, plan: null, checked: {} };
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
    if (Array.isArray(raw.profile.favorites)) {
      state.profile.favorites = recipes.map(item => item.id).filter(id => raw.profile.favorites.includes(id));
    }
    if (Array.isArray(raw.profile.favoriteWorkouts)) {
      state.profile.favoriteWorkouts = workouts.map(item => item.id).filter(id => raw.profile.favoriteWorkouts.includes(id));
    }
    if (recipes.some(item => item.id === raw.plan?.meal) && workouts.some(item => item.id === raw.plan?.workout)) {
      state.plan = {
        meal: raw.plan.meal, workout: raw.plan.workout,
        servings: servingOptions.includes(raw.plan.servings) ? raw.plan.servings : 1,
        source: planSources.includes(raw.plan.source) ? raw.plan.source : 'saved'
      };
    }
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
