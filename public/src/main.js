import { recipes, workouts, markets } from './catalog.js';
import { activityCalories, calories, habitPlan, mapsUrl, mealMatches, planOptions, preferences, scenarios } from './planner.js';
import { freshState, readState, saveState, servingOptions } from './storage.js';
import { checkDevice, cloudConfigured, connectionState, generatePlan, loadConfig } from './ai.js';
import { language, localize, t } from './locales.js';
import { displayActivity, displayMeal } from './catalog-locales.js';
import { mountNearby, nearbyPanel } from './nearby-view.js';

const byId = id => document.getElementById(id);
const dialog = byId('details-dialog');
const nativeLive = typeof window.VieraNative?.postMessage === 'function';
const liveLabel = {
  cooking: t('Call Gemini to cook'),
  fitness: t('Call Gemini to work out')
};
const mealCopy = item => displayMeal(item, language);
const activityCopy = item => displayActivity(item, language);
const openImage = recipe => `./assets/${recipe.id}.webp`;
const labels = {
  device: 'Gemini Nano · on-device', cloud: 'Gemini Cloud · Firebase AI Logic',
  catalog: 'Offline Rules', manual: 'Your selections', saved: 'Saved plan'
};
const reasons = {
  'device-unavailable': 'Gemini Nano is unavailable here. The recipe library is available.',
  'firebase-config-missing': 'The Firebase project configuration has not been installed.',
  'cloud-not-configured': 'Cloud is unavailable until a Spark project and App Check are configured.',
  'app-check': 'Cloud attestation or permissions failed.',
  'quota': 'Gemini Cloud reached its request limit. Wait at least a minute or choose Offline Rules.',
  'device-quota': 'Gemini Nano reached its on-device request limit.',
  'device-check-failed': 'The Gemini Nano availability check did not complete.',
  'offline': 'The connection is unavailable.',
  'deadline': 'The request took too long.',
  'invalid-selection': 'The model did not return a usable choice from the recipe library.',
  'cloud-over-effort': 'The demo suggestion exceeded your locally saved effort limit.',
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
let draft;
let libraryTargetChosen = false;
let nearbyRefresh;
let nearbyActivate;
let nearbyDispose;

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
  const settings = filters();
  const matches = mealMatches(settings, state.profile, mealCopy);
  byId('recipe-count').textContent = `${matches.length} ${t(matches.length === 1 ? 'recipe' : 'recipes')}`;
  byId('recipe-grid').innerHTML = matches.map(mealCopy).map(recipe => `
    <article class="recipe-card">
      <div class="card-picture"><img src="${openImage(recipe)}" alt="" loading="lazy">${favoriteButton(recipe.id, recipe.name, state.profile.favorites.includes(recipe.id), 'like')}</div>
      <div class="card-body"><p class="kicker">${recipe.origin}</p><h3>${recipe.name}</h3>
      <p class="metric"><strong>≈ ${calories(recipe)} kcal</strong> · ${recipe.minutes} ${t('min')}</p>
      <button class="text-button" data-recipe="${recipe.id}" ${libraryTargetChosen ? `data-target="${settings.target}"` : ''}>View recipe</button></div>
    </article>`).join('') || '<p class="empty">No recipes match these filters. Try another ingredient or cuisine.</p>';
  localize(byId('recipe-grid'));
}

function renderActivities() {
  byId('activity-grid').innerHTML = workouts.map(activityCopy).map(workout => `
    <article class="activity-card">
      <div class="activity-head"><p class="kicker">${workout.intensity}</p>
      ${favoriteButton(workout.id, workout.name, state.profile.favoriteWorkouts.includes(workout.id), 'like-workout')}</div>
      <h3>${workout.name}</h3><p class="metric">${workout.minutes} ${t('min')} · ≈ ${activityCalories(workout)} kcal</p>
      <button class="text-button" data-workout="${workout.id}">See routine</button>
    </article>`).join('');
  localize(byId('activity-grid'));
}

function liveButton(mode, workout = '') {
  if (!nativeLive) return '';
  return `<button type="button" class="button primary" data-live="${mode}" data-live-workout="${workout}">${liveLabel[mode]}</button>`;
}

function openLive(mode, workout) {
  if (!nativeLive || (mode === 'cooking' && !selectedRecipe)) return;
  const context = mode === 'cooking'
    ? [selectedRecipe.name, `${servings} serving(s)`,
      selectedRecipe.ingredients.map(item => `${item.name} ${Math.round(item.grams * servings)} g`).join(', '),
      selectedRecipe.steps.map(([title, instruction]) => `${title}: ${instruction}`).join(' ')].join('. ')
    : workout;
  window.VieraNative.postMessage(JSON.stringify({
    id: 'open-live', operation: 'open-live', mode, context,
    ...(mode === 'cooking' && {
      recipeId: selectedRecipe.id,
      subject: selectedRecipe.name,
      steps: selectedRecipe.steps.map(([title]) => title)
    })
  }));
}

function renderResult(result) {
  const details = byId('run-details');
  details.hidden = !result || result.saved || result.source === 'manual';
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
  const { meal, workout, focus, source, reason, localFailure, milliseconds, modelName, saved } = result;
  const portion = result.servings ?? 1;
  const headline = saved ? 'Your saved plan' : 'Suggested pairing';
  byId('plan-result').innerHTML = `
    <div class="result" data-plan-source="${source}">
      <span class="source">${labels[source]}</span>
      <h3>${headline}</h3>
      ${explanations[focus] ? `<p class="hint">${explanations[focus]}</p>` : ''}
      <button class="plan-item" data-recipe="${meal.id}" data-portion="${portion}" ${result.target ? `data-target="${result.target}"` : ''}><strong>${mealCopy(meal).name}</strong><small>${portion} × ${t('serving')} · ≈ ${calories(meal, portion)} kcal</small></button>
      <button class="plan-item" data-workout="${workout.id}"><strong>${activityCopy(workout).name}</strong><small>${workout.minutes} ${t('min')} · ${t(workout.intensity)}</small></button>
      ${saved ? '' : '<button type="button" class="button primary" data-save-draft>Save this pairing</button>'}
    </div>`;
  const metadata = [['Source', labels[source]]];
  if (reason && reasons[reason]) metadata.push(['Fallback', reasons[reason]]);
  if (localFailure && localFailure !== reason && reasons[localFailure]) metadata.push(['Gemini Nano', reasons[localFailure]]);
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
  localize(byId('plan-result'));
  localize(byId('run-metadata'));
}

function setDeviceLabel() {
  const device = {
    available: 'Gemini Nano is ready on this device.',
    downloadable: 'Gemini Nano needs separate device setup.',
    downloading: 'The runtime is still preparing Gemini Nano.',
    unsupported: 'Gemini Nano · this device does not have Android AICore.',
    'setup-required': 'Gemini Nano · Firebase setup is required before checking this device.',
    unknown: 'Gemini Nano · the availability check did not complete.',
    unavailable: 'Gemini Nano · no supported model is available on this device.'
  }[deviceStatus];
  byId('device-state').textContent = t(device ?? 'Checking Gemini Nano…');
  const configured = cloudConfigured();
  const online = connectionState();
  byId('cloud-state').textContent = t(!configured
    ? 'Gemini Cloud · Firebase project is not configured.'
    : online === false ? 'Gemini Cloud · waiting for an internet connection.'
      : 'Gemini Cloud · configured. Consent is required for each session.');
}

function toggleNetwork() {
  const online = connectionState();
  byId('network-label').textContent = t(online === null ? 'Checking connection…' : online ? 'Online' : 'Offline');
  document.querySelector('.network').classList.toggle('offline', online !== true);
  nearbyRefresh?.();
}

async function updateStatus() {
  deviceStatus = await checkDevice();
  setDeviceLabel();
  toggleNetwork();
}

function renderSelection() {
  const manual = draft?.source === 'manual' ? draft : null;
  const panel = byId('plan-selection');
  panel.hidden = !manual;
  panel.innerHTML = manual ? `
    <h3>Your selections</h3>
    <p>${manual.meal ? `${mealCopy(manual.meal).name} · ${manual.servings} × ${t('serving')} · ≈ ${calories(manual.meal, manual.servings)} kcal` : 'Choose a recipe from Meals.'}</p>
    <p>${manual.workout ? `${activityCopy(manual.workout).name} · ${manual.workout.minutes} ${t('min')}` : 'Choose an activity from Movement.'}</p>
    <button type="button" class="button primary" data-save-draft ${!manual.meal || !manual.workout ? 'disabled' : ''}>Save my plan</button>` : '';
  localize(panel);
}

function renderSaved() {
  if (!state.plan) {
    renderResult(null);
    return;
  }
  renderResult({
    ...state.plan, saved: true,
    meal: recipes.find(item => item.id === state.plan.meal),
    workout: workouts.find(item => item.id === state.plan.workout)
  });
}

function saveDraft() {
  if (busy || !draft?.meal || !draft?.workout) return;
  state.plan = { meal: draft.meal.id, workout: draft.workout.id, servings: draft.servings ?? 1, source: draft.source };
  byId('plan-status').textContent = t(saveState(state) ? 'Plan saved on this device.' : 'Plan saved for this session.');
  draft = null;
  renderSelection();
  renderSaved();
}

async function buildPlan(event) {
  event.preventDefault();
  if (busy) return;
  const filter = { ...filters(), scenario: byId('scenario').value, vegetarian: byId('vegetarian').checked };
  const profile = state.profile;
  const options = planOptions(filter, profile);
  const cloudOptions = planOptions(filter, demoProfile);
  const status = byId('plan-status');
  if (!options.mealOptions.length || !options.movementOptions.length) {
    draft = null;
    renderSelection();
    renderSaved();
    status.textContent = t('These filters leave no pairing. Try a different day or cuisine.');
    return;
  }
  busy = true;
  const submit = byId('build-plan');
  submit.disabled = true;
  status.textContent = t('Building your pairing…');
  draft = null;
  renderSelection();
  renderSaved();
  const mode = byId('mode').value;
  try {
    if (mode !== 'rules') await updateStatus();
    const reply = await generatePlan({
      mode, options, profile, cloudOptions, cloudProfile: demoProfile, availability: deviceStatus,
      allowCloud: byId('cloud-consent').checked
    });
    const result = reply.source === 'catalog'
      ? { ...reply, target: options.target, meal: options.mealOptions[0], workout: options.movementOptions[0] }
      : { ...reply, target: options.target };
    draft = result;
    renderResult(result);
    const fallback = result.source === 'catalog' && reasons[result.reason] ? `${t(reasons[result.reason])} ` : '';
    status.textContent = `${fallback}${t('Review and save the pairing when ready.')}`;
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
  nearbyRefresh?.();
}

function recipeDetails(recipe, portion) {
  selectedRecipe = recipe;
  servings = servingOptions.includes(portion) ? portion : 1;
  const grocery = state.checked[recipe.id] ?? [];
  const stores = markets.filter(market => recipe.ingredients.some(item => market.aisles.includes(item.aisle)));
  return `<img class="dialog-photo" src="${openImage(recipe)}" alt="">
    <p class="eyebrow">${t(recipe.origin)} · ${recipe.minutes} ${t('min')}</p><h2 id="dialog-heading">${recipe.name}</h2>
    <p class="subtle">${recipe.description}</p>
    <div class="portion"><label for="servings">Servings</label><select id="servings"><option value="0.5">½</option><option value="1" selected>1</option><option value="1.5">1½</option><option value="2">2</option><option value="3">3</option></select>
    <strong id="portion-energy">≈ ${calories(recipe, servings)} kcal</strong></div>
    <p class="hint">Rounded to the nearest 5 kcal from recipe ingredient weights and reference values, including <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a>. Brands and preparation can change the total.</p>
    <div class="meal-path" role="group" aria-label="How will you get this meal?">
      <button class="button outline" type="button" data-meal-path="cook" aria-pressed="true" aria-controls="cook-meal">Cook it myself</button>
      <button class="button outline" type="button" data-meal-path="buy" aria-pressed="false" aria-controls="buy-meal">Buy it nearby</button>
    </div>
    <div id="cook-meal">
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
    ${liveButton('cooking')}
    <ol>${recipe.steps.map(([title, instruction]) => `<li><strong>${title}</strong><p>${instruction}</p></li>`).join('')}</ol>
    <p class="hint">${t('Reference video')} · ${recipe.creator}</p>
    <p><button class="button outline" data-video="${recipe.video}">Load cooking video</button>
    <a class="button outline" href="https://www.youtube.com/watch?v=${recipe.video}" target="_blank" rel="noopener noreferrer">Open on YouTube</a></p>
    <div class="video-frame"></div></section></div>
    ${nearbyPanel}
    <div class="dialog-section"><button type="button" class="button primary" data-select-meal>Add meal and choose movement</button></div>`;
}

function setMealPath(path) {
  byId('buy-meal').hidden = path !== 'buy';
  byId('cook-meal').hidden = path !== 'cook';
  for (const button of dialog.querySelectorAll('[data-meal-path]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mealPath === path));
  }
  if (path === 'buy') nearbyActivate?.();
  else nearbyDispose?.();
}

function showRecipe(recipe, portion, selection, path = 'cook') {
  const content = byId('dialog-content');
  nearbyDispose?.();
  content.innerHTML = recipeDetails(mealCopy(recipe), portion);
  localize(content);
  const nearby = mountNearby(byId('buy-meal'), {
    recipe: selectedRecipe, getServings: () => servings,
    getOnline: () => navigator.onLine && connectionState() !== false,
    profile: state.profile, selection,
    onChoose: ({ recipe: substitute, portion: preferredPortion }, target) => {
      showRecipe(substitute, preferredPortion, { ...selection, target }, 'buy');
      dialog.scrollTop = 0;
      dialog.querySelector('[data-meal-path="buy"]').focus({ preventScroll: true });
    }
  });
  nearbyRefresh = nearby.refresh;
  nearbyActivate = nearby.activate;
  nearbyDispose = nearby.dispose;
  byId('servings').value = String(servings);
  updateServing();
  setMealPath(path);
}

function openDetails(trigger, recipe, workout) {
  detailTrigger = trigger;
  selectedRecipe = null;
  nearbyDispose?.();
  nearbyDispose = undefined;
  nearbyActivate = undefined;
  nearbyRefresh = undefined;
  if (workout) workout = activityCopy(workout);
  if (recipe) {
    showRecipe(recipe, Number(trigger.dataset.portion), {
      target: Number(trigger.dataset.target) || undefined, vegetarian: byId('vegetarian').checked
    });
  } else {
    byId('dialog-content').innerHTML = `
    <p class="eyebrow">${t(workout.intensity)} · ${workout.minutes} ${t('min')}</p>
    <h2 id="dialog-heading">${workout.name}</h2>
    <p class="subtle">${t('Approx.')} ${activityCalories(workout)} kcal ${t('at the demo weight of 70 kg. Pick a pace that feels comfortable.')}</p>
    <div class="dialog-section"><h3>Follow the routine</h3>
    ${liveButton('fitness', workout.id)}<ol>
    ${workout.steps.map(step => `<li>${step}</li>`).join('')}</ol>
    <button type="button" class="button primary" data-select-workout="${workout.id}">Add movement to my plan</button></div>`;
    localize(byId('dialog-content'));
  }
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
    ? `<div class="habit"><h3>${t(plan.title).replace('a goal to review', t('a goal to review'))}</h3><ol>${plan.weeks.map(week => `<li>${t(week)}</li>`).join('')}</ol></div>`
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
  byId('profile-status').textContent = t(saveState(state) ? 'Preferences saved in this browser.' : 'Preferences updated for this session.');
  renderMeals();
  updateProfileForm();
}

document.addEventListener('click', event => {
  const trigger = event.target.closest('button');
  if (!trigger) return;
  if (trigger.dataset.mealPath) {
    setMealPath(trigger.dataset.mealPath);
    return;
  }
  if (trigger.dataset.live) {
    openLive(trigger.dataset.live, trigger.dataset.liveWorkout);
    return;
  }
  if (trigger.hasAttribute('data-save-draft')) {
    saveDraft();
    return;
  }
  const selectingMeal = trigger.hasAttribute('data-select-meal');
  const selectingWorkout = trigger.dataset.selectWorkout;
  if ((selectingMeal || selectingWorkout) && !busy) {
    const current = draft ?? {};
    draft = selectingMeal
      ? { source: 'manual', meal: selectedRecipe, servings, workout: current.workout }
      : { source: 'manual', meal: current.meal, servings: current.servings, workout: workouts.find(item => item.id === selectingWorkout) };
    detailTrigger = null;
    dialog.close();
    renderSelection();
    renderSaved();
    byId('plan-status').textContent = '';
    const next = selectingMeal && !draft.workout ? 'activity' : 'daily-plan';
    location.hash = next;
    byId(next).scrollIntoView();
    return;
  }
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
    dialog.querySelector('.video-frame').textContent = t('Connect to the internet to load this video.');
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
  nearbyDispose?.();
  nearbyDispose = undefined;
  nearbyActivate = undefined;
  nearbyRefresh = undefined;
  byId('dialog-content').replaceChildren();
  detailTrigger?.focus({ preventScroll: true });
});
byId('meal-filter').addEventListener('submit', event => event.preventDefault());
byId('meal-kcal').addEventListener('input', () => { libraryTargetChosen = true; });
byId('meal-filter').addEventListener('input', renderMeals);
byId('plan-form').addEventListener('submit', buildPlan);
byId('profile-form').addEventListener('submit', saveProfile);
byId('goal').addEventListener('change', updateGoalInput);
byId('reset-profile').addEventListener('click', () => {
  if (busy || !confirm('Clear saved preferences, shopping checklists and the last plan from this browser?')) return;
  state = freshState();
  draft = null;
  renderSelection();
  byId('cloud-consent').checked = false;
  byId('profile-status').textContent = t(saveState(state) ? 'Local data cleared.' : 'Session data cleared.');
  byId('plan-status').textContent = '';
  renderResult(null);
  renderMeals();
  renderActivities();
  updateProfileForm();
});

document.documentElement.lang = language;
byId('scenario').innerHTML = Object.entries(scenarios).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join('');
localize(document.body);
document.querySelector('.photo-caption strong').textContent = mealCopy(recipes[0]).name;
renderMeals();
renderActivities();
if (nativeLive) byId('live-fitness-entry').innerHTML = liveButton('fitness');
updateProfileForm();
renderSelection();
renderSaved();
toggleNetwork();
addEventListener('online', updateStatus);
addEventListener('offline', updateStatus);
addEventListener('online', () => nearbyRefresh?.());
addEventListener('offline', () => nearbyRefresh?.());
addEventListener('focus', updateStatus);
loadConfig().then(updateStatus);
if ('serviceWorker' in navigator && !navigator.userAgent.includes('VieraAndroid/1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
