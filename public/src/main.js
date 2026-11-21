import { recipes, workouts, markets } from './catalog.js';
import { activityCalories, calories, habitPlan, mapsUrl, mealMatches, planOptions, preferences, scenarios } from './planner.js';
import { freshState, readState, saveState } from './storage.js';
import { checkDevice, cloudConfigured, generatePlan, loadConfig } from './ai.js';

const byId = id => document.getElementById(id);
const dialog = byId('details-dialog');
const openImage = recipe => `./assets/${recipe.id}.webp`;
const labels = {
  device: 'On-device · Gemini Nano', cloud: 'Cloud · Firebase AI Logic', catalog: 'Recipe library · Offline rules', saved: 'Saved plan'
};
const reasons = {
  'device-unavailable': 'Gemini Nano is unavailable here. The recipe library is available.',
  'firebase-config-missing': 'The Firebase project configuration has not been installed.',
  'cloud-not-configured': 'Cloud is unavailable until a Spark project and App Check are configured.',
  'app-check': 'Cloud attestation or permissions failed.',
  'quota': 'The cloud request limit was reached. Try again later.',
  'offline': 'The connection is unavailable.',
  'deadline': 'The request took too long.',
  'invalid-selection': 'The model did not return a usable choice from the recipe library.',
  'unexpected-source': 'The SDK did not confirm where the response ran.',
  'service-error': 'The coaching service could not complete this request.',
  'cloud-consent': 'Cloud coaching requires your permission to send a synthetic demo prompt.'
};
const demoProfile = { ...preferences, cuisine: 'Asian', taste: 'Herby', movement: 'Walking' };
let state = readState();
let busy = false;
let deviceStatus;
let selectedRecipe;
let servings = 1;
let detailTrigger;

function filters() {
  const target = byId('meal-kcal').valueAsNumber;
  return {
    target: Number.isFinite(target) ? Math.max(200, Math.min(1000, target)) : 500,
    cuisine: byId('cuisine').value,
    search: byId('dish-search').value,
    favoritesOnly: byId('favorites-only').checked
  };
}

function favoriteButton(id, name, active, action) {
  return `<button type="button" class="icon-button" data-${action}="${id}" aria-pressed="${active}" aria-label="Favorite ${name}">${active ? '♥' : '♡'}</button>`;
}

function renderMeals() {
  const matches = mealMatches(filters(), state.profile);
  byId('recipe-count').textContent = `${matches.length} ${matches.length === 1 ? 'recipe' : 'recipes'}`;
  byId('recipe-grid').innerHTML = matches.map(recipe => `
    <article class="recipe-card">
      <div class="card-picture"><img src="${openImage(recipe)}" alt="" loading="lazy">${favoriteButton(recipe.id, recipe.name, state.profile.favorites.includes(recipe.id), 'like')}</div>
      <div class="card-body"><p class="kicker">${recipe.origin}</p><h3>${recipe.name}</h3>
      <p class="metric"><strong>≈ ${calories(recipe)} kcal</strong> · ${recipe.minutes} min</p>
      <button class="text-button" data-recipe="${recipe.id}">View recipe</button></div>
    </article>`).join('') || '<p class="empty">No recipes match these filters. Try another ingredient or cuisine.</p>';
}

function renderActivities() {
  byId('activity-grid').innerHTML = workouts.map(workout => `
    <article class="activity-card">
      <div class="activity-head"><p class="kicker">${workout.intensity}</p>
      ${favoriteButton(workout.id, workout.name, state.profile.favoriteWorkouts.includes(workout.id), 'like-workout')}</div>
      <h3>${workout.name}</h3><p class="metric">${workout.minutes} min · ≈ ${activityCalories(workout)} kcal</p>
      <button class="text-button" data-workout="${workout.id}">See routine</button>
    </article>`).join('');
}

function renderResult(result) {
  const details = byId('run-details');
  details.hidden = !result || result.source === 'saved';
  details.open = false;
  if (!result) {
    byId('plan-result').replaceChildren();
    return;
  }
  const explanations = {
    time: 'These picks fit the time and equipment you selected.',
    energy: 'The meal choice considers your per-plate estimate.',
    taste: 'The pairing considers the preferences used for this run.'
  };
  const { meal, workout, focus, source, reason, milliseconds, modelName } = result;
  const headline = source === 'saved' ? 'Your last saved pairing' : 'Your meal & movement pairing';
  byId('plan-result').innerHTML = `
    <div class="result" data-plan-source="${source}">
      <span class="source">${labels[source]}</span>
      <h3>${headline}</h3>
      ${explanations[focus] ? `<p class="hint">${explanations[focus]}</p>` : ''}
      <button class="plan-item" data-recipe="${meal.id}"><strong>${meal.name}</strong><small>≈ ${calories(meal)} kcal · ${meal.minutes} min</small></button>
      <button class="plan-item" data-workout="${workout.id}"><strong>${workout.name}</strong><small>${workout.minutes} min · ${workout.intensity}</small></button>
    </div>`;
  const metadata = [['Source', labels[source]]];
  if (reason && reasons[reason]) metadata.push(['Fallback', reasons[reason]]);
  if (modelName) metadata.push(['Model', modelName]);
  if (source === 'cloud') metadata.push(['App Check', 'Token acquired']);
  if (milliseconds !== undefined) metadata.push(['Elapsed', `${milliseconds} ms`]);
  const nodes = metadata.flatMap(([name, value]) => {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = name;
    description.textContent = value;
    return [term, description];
  });
  byId('run-metadata').replaceChildren(...nodes);
}

function setDeviceLabel() {
  const device = {
    available: 'Gemini Nano is ready on this device.',
    downloadable: 'Gemini Nano needs separate device setup.',
    downloading: 'The runtime is still preparing Gemini Nano.',
    unavailable: 'Gemini Nano is unavailable on this browser or device.'
  }[deviceStatus];
  byId('device-state').textContent = `${device ?? 'Checking Gemini Nano.'} ${cloudConfigured() ? 'Cloud configured.' : 'Cloud setup pending.'}`;
}

function toggleNetwork() {
  byId('network-label').textContent = navigator.onLine ? 'Local profile' : 'Offline';
  document.querySelector('.network').classList.toggle('offline', !navigator.onLine);
}

async function buildPlan(event) {
  event.preventDefault();
  if (busy) return;
  const filter = { ...filters(), scenario: byId('scenario').value, vegetarian: byId('vegetarian').checked };
  const profile = state.profile;
  const options = planOptions(filter, profile);
  const cloudProfile = profile.intensity === 'Gentle' ? { ...demoProfile, intensity: 'Gentle' } : demoProfile;
  const cloudOptions = planOptions(filter, cloudProfile);
  const status = byId('plan-status');
  if (!options.mealOptions.length || !options.movementOptions.length) {
    renderResult(null);
    status.textContent = 'These filters leave no pairing. Try a different day or cuisine.';
    return;
  }
  busy = true;
  const submit = byId('build-plan');
  submit.disabled = true;
  status.textContent = 'Building your pairing…';
  renderResult(null);
  const mode = byId('mode').value;
  try {
    deviceStatus = mode === 'cloud' ? deviceStatus : await checkDevice();
    const reply = await generatePlan({
      mode, options, profile, cloudOptions, cloudProfile, availability: deviceStatus,
      allowCloud: byId('cloud-consent').checked
    });
    const result = reply.source === 'catalog'
      ? { ...reply, meal: options.mealOptions[0], workout: options.movementOptions[0] }
      : reply;
    state.plan = { meal: result.meal.id, workout: result.workout.id };
    const saved = saveState(state);
    renderResult(result);
    const fallback = result.source === 'catalog' && reasons[result.reason] ? `${reasons[result.reason]} ` : '';
    status.textContent = `${fallback}${saved ? 'Plan saved in this browser.' : 'Plan available for this session.'}`;
  } finally {
    submit.disabled = false;
    busy = false;
    setDeviceLabel();
  }
}

function updateServing() {
  byId('portion-energy').textContent = `≈ ${calories(selectedRecipe, servings)} kcal`;
  dialog.querySelectorAll('[data-grams]').forEach(element => {
    element.textContent = `${Math.round(Number(element.dataset.grams) * servings)} g`;
  });
}

function recipeDetails(recipe) {
  selectedRecipe = recipe;
  servings = 1;
  const grocery = state.checked[recipe.id] ?? [];
  const stores = markets.filter(market => recipe.ingredients.some(item => market.aisles.includes(item.aisle)));
  return `<img class="dialog-photo" src="${openImage(recipe)}" alt="">
    <p class="eyebrow">${recipe.origin} · ${recipe.minutes} min</p><h2 id="dialog-heading">${recipe.name}</h2>
    <p class="subtle">${recipe.description}</p>
    <div class="portion"><label for="servings">Servings</label><select id="servings"><option value="0.5">½</option><option value="1" selected>1</option><option value="1.5">1½</option><option value="2">2</option><option value="3">3</option></select>
    <strong id="portion-energy">≈ ${calories(recipe)} kcal</strong></div>
    <p class="hint">Estimated from ingredient amounts. Brands, preparation and portion sizes change the total.</p>
    <section class="dialog-section"><h3>Shopping list</h3>
    <div class="grocery">${recipe.ingredients.map((item, index) => `
      <label class="check"><input type="checkbox" data-ingredient="${index}" ${grocery.includes(index) ? 'checked' : ''}>
      <span>${item.name} · <span data-grams="${item.grams}">${item.grams} g</span></span></label>`).join('')}</div>
    <details><summary>Where to shop</summary><p class="hint">Ho Chi Minh City suggestions. Check opening hours and stock in Maps.</p>
    <div class="markets">${stores.map(store => `<div class="market"><strong>${store.name}</strong><p>${store.address}</p>
      <a class="text-button" href="${mapsUrl(store.query, true).replaceAll('&', '&amp;')}" target="_blank" rel="noopener noreferrer">Directions</a></div>`).join('')}</div>
    <a class="text-button" href="${mapsUrl('grocery store').replaceAll('&', '&amp;')}" target="_blank" rel="noopener noreferrer">Find groceries near me in Maps</a>
    </details></section>
    <section class="dialog-section"><h3>Cook step by step</h3>
    <ol>${recipe.steps.map(([title, instruction]) => `<li><strong>${title}</strong><p>${instruction}</p></li>`).join('')}</ol>
    <p class="hint">Technique video by ${recipe.creator}. Use the portions listed above for this version. Video needs internet.</p>
    <p><button class="button outline" data-video="${recipe.video}">Load cooking video</button>
    <a class="button outline" href="https://www.youtube.com/watch?v=${recipe.video}" target="_blank" rel="noopener noreferrer">Open on YouTube</a></p>
    <div class="video-frame"></div></section>`;
}

function openDetails(trigger, recipe, workout) {
  detailTrigger = trigger;
  selectedRecipe = null;
  byId('dialog-content').innerHTML = recipe ? recipeDetails(recipe) : `
    <p class="eyebrow">${workout.intensity} · ${workout.minutes} min</p>
    <h2 id="dialog-heading">${workout.name}</h2>
    <p class="subtle">Approx. ${activityCalories(workout)} kcal at the demo weight of 70 kg. Pick a pace that feels comfortable.</p>
    <div class="dialog-section"><h3>Follow the routine</h3><ol>
    ${workout.steps.map(step => `<li>${step}</li>`).join('')}</ol></div>`;
  dialog.showModal();
  dialog.scrollTop = 0;
}

function updateProfileForm() {
  for (const [id, property] of Object.entries({
    'preferred-cuisine': 'cuisine', taste: 'taste', intensity: 'intensity', movement: 'movement', goal: 'goal'
  })) byId(id).value = state.profile[property];
  byId('change').value = state.profile.change || '';
  updateGoalInput();
  const plan = habitPlan(state.profile.goal, state.profile.change);
  byId('habit-plan').innerHTML = plan
    ? `<div class="habit"><h3>${plan.title}</h3><ol>${plan.weeks.map(week => `<li>${week}</li>`).join('')}</ol></div>`
    : '';
}

function updateGoalInput() {
  const change = byId('change');
  change.disabled = byId('goal').value === 'Maintain';
  change.required = !change.disabled;
}

function saveProfile(event) {
  event.preventDefault();
  state.profile = {
    ...state.profile, cuisine: byId('preferred-cuisine').value, taste: byId('taste').value,
    intensity: byId('intensity').value, movement: byId('movement').value, goal: byId('goal').value,
    change: byId('change').disabled ? 0 : byId('change').valueAsNumber
  };
  byId('profile-status').textContent = saveState(state) ? 'Preferences saved in this browser.' : 'Preferences updated for this session.';
  renderMeals();
  updateProfileForm();
}

document.addEventListener('click', event => {
  const trigger = event.target.closest('button');
  if (!trigger) return;
  const { recipe, workout, like, likeWorkout, video } = trigger.dataset;
  if (recipe || workout) {
    const dish = recipes.find(item => item.id === recipe);
    const routine = workouts.find(item => item.id === workout);
    if (dish || routine) openDetails(trigger, dish, routine);
  }
  if (like || likeWorkout) {
    const property = like ? 'favorites' : 'favoriteWorkouts';
    const id = like ?? likeWorkout;
    const active = state.profile[property].includes(id);
    state.profile[property] = active ? state.profile[property].filter(value => value !== id) : [...state.profile[property], id];
    saveState(state);
    const attribute = like ? 'data-like' : 'data-like-workout';
    if (like) renderMeals();
    else renderActivities();
    document.querySelector(`[${attribute}="${id}"]`)?.focus({ preventScroll: true });
  }
  if (video && selectedRecipe?.video === video && navigator.onLine) {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${video}`;
    iframe.title = `Cooking video for ${selectedRecipe.name}`;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    dialog.querySelector('.video-frame').replaceChildren(iframe);
  } else if (video) {
    dialog.querySelector('.video-frame').textContent = 'Connect to the internet to load this video.';
  }
});

dialog.addEventListener('change', event => {
  if (event.target.id === 'servings') {
    servings = Number(event.target.value);
    updateServing();
  }
  if (event.target.dataset.ingredient !== undefined && selectedRecipe) {
    state.checked[selectedRecipe.id] = Array.from(dialog.querySelectorAll('[data-ingredient]:checked'), element => Number(element.dataset.ingredient));
    saveState(state);
  }
});
dialog.addEventListener('close', () => {
  byId('dialog-content').replaceChildren();
  detailTrigger?.focus({ preventScroll: true });
});
byId('meal-filter').addEventListener('submit', event => event.preventDefault());
byId('meal-filter').addEventListener('input', renderMeals);
byId('plan-form').addEventListener('submit', buildPlan);
byId('profile-form').addEventListener('submit', saveProfile);
byId('goal').addEventListener('change', updateGoalInput);
byId('reset-profile').addEventListener('click', () => {
  if (busy || !confirm('Clear saved preferences, shopping checklists and the last plan from this browser?')) return;
  state = freshState();
  byId('cloud-consent').checked = false;
  byId('profile-status').textContent = saveState(state) ? 'Local data cleared.' : 'Session data cleared.';
  byId('plan-status').textContent = '';
  renderResult(null);
  renderMeals();
  renderActivities();
  updateProfileForm();
});

byId('scenario').innerHTML = Object.entries(scenarios).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join('');
renderMeals();
renderActivities();
updateProfileForm();
if (state.plan) renderResult({
  meal: recipes.find(item => item.id === state.plan.meal),
  workout: workouts.find(item => item.id === state.plan.workout), source: 'saved'
});
toggleNetwork();
addEventListener('online', toggleNetwork);
addEventListener('offline', toggleNetwork);
Promise.all([loadConfig(), checkDevice()]).then(([, availability]) => {
  deviceStatus = availability;
  setDeviceLabel();
});
if ('serviceWorker' in navigator && !navigator.userAgent.includes('VieraAndroid/1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
