import { recipes, workouts } from './catalog.js';
import { activityCalories, activityOptions, calories, habitPlan, mealMatches, planOptions, preferences, scenarios } from './planner.js';
import { freshState, normalizeCompletedPlans, readState, recordCompletion, saveState, servingOptions } from './storage.js';
import { checkDevice, cloudConfigured, connectionState, generatePlan, liveAvailable, loadConfig, nanoDownloadStatus, nativeRequest, startNanoDownload } from './ai.js';
import { language, localize, t } from './locales.js';
import { displayActivity, displayMeal } from './catalog-locales.js';
import { groceryPanel, mountNearby, nearbyPanel } from './nearby-view.js';

const byId = id => document.getElementById(id);
const dialog = byId('details-dialog');
const nativeLive = typeof window.VieraNative?.postMessage === 'function';
const mealCopy = item => displayMeal(item, language);
const activityCopy = item => displayActivity(item, language);
const mealImage = (recipe, attributes = '') => `<img src="./assets/${recipe.id}.webp" alt="" ${attributes}>`;
const formatNumber = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
const mealMetrics = (meal, portion = 1) => `<strong class="energy-figure">≈ ${calories(meal, portion)} kcal</strong><span>${meal.minutes} ${t('min')}</span>`;
const movementArt = workout => `<span class="movement-art movement-${workout.id}" aria-hidden="true"></span>`;
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
let historyBusy = false;
const historyReady = nativeLive ? restoreCompletedHistory() : Promise.resolve();
let busy = false;
let deviceStatus;
let statusUpdate;
let nanoPoll;
let nanoStarting = false;
let nanoStartError;
let selectedRecipe;
let servings = 1;
let mealPath;
let mealSelection;
let draftPathChanged = false;
let detailTrigger;
let draft;
let libraryTargetChosen = false;
let nearbyRefresh;
let nearbyActivate;
let nearbyDispose;
let groceries;

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
  return `<button type="button" class="icon-button" data-${action}="${id}" aria-pressed="${active}" aria-label="${t('Favorite')} · ${name}">${active ? '♥' : '♡'}</button>`;
}

function renderMeals() {
  const settings = filters();
  const taste = byId('meal-taste').value;
  const matches = mealMatches({ ...settings, vegetarian: byId('library-vegetarian').checked,
    mealMinutes: Number(byId('meal-minutes').value) || Infinity }, recommendationProfile(), mealCopy)
    .filter(recipe => taste === 'Any' || recipe.tastes.includes(taste));
  byId('recipe-count').textContent = `${matches.length} ${t(matches.length === 1 ? 'recipe' : 'recipes')}`;
  byId('recipe-grid').innerHTML = matches.map(mealCopy).map(recipe => `
    <article class="recipe-card">
      <div class="card-picture">${mealImage(recipe, 'loading="lazy"')}${favoriteButton(recipe.id, recipe.name, state.profile.favorites.includes(recipe.id), 'like')}</div>
      <div class="card-body"><p class="kicker">${t(recipe.origin)}</p>
        <h3><button class="card-link" type="button" data-recipe="${recipe.id}" data-vegetarian="${byId('library-vegetarian').checked}" ${libraryTargetChosen ? `data-target="${settings.target}"` : ''}>${recipe.name}</button></h3>
        <p class="metric">${mealMetrics(recipe)}</p>
      </div>
    </article>`).join('') || '<p class="empty">No recipes match. Try another filter.</p>';
  localize(byId('recipe-grid'));
}

function recommendationProfile() {
  return { ...state.profile, completedMeals: state.completed.map(plan => plan.meal),
    completedWorkouts: state.completed.map(plan => plan.workout) };
}

function energyFor(workout) {
  return activityCalories(workout, state.profile.bodyWeight);
}

function movementEstimateBasis() {
  const weight = state.profile.bodyWeight;
  return weight ? t('Estimated at your saved weight of {weight} kg. Actual energy use varies.').replace('{weight}', formatNumber.format(weight))
    : t('Estimated at a reference weight of 70 kg. Actual energy use varies.');
}

function renderActivities() {
  byId('activity-estimate-basis').textContent = movementEstimateBasis();
  byId('activity-grid').innerHTML = activityOptions(recommendationProfile()).map(activityCopy).map(workout => `
    <article class="activity-card">
      <div class="card-picture">${movementArt(workout)}
        ${favoriteButton(workout.id, workout.name, state.profile.favoriteWorkouts.includes(workout.id), 'like-workout')}
      </div>
      <div class="card-body"><p class="kicker">${t(workout.intensity)}</p>
        <h3><button class="card-link" type="button" data-workout="${workout.id}">${workout.name}</button></h3>
        <p class="metric"><strong class="energy-figure">≈ ${energyFor(workout)} kcal</strong><span>${workout.minutes} ${t('min')} · ${t(workout.equipment === 'None' ? 'No equipment' : workout.equipment)}</span></p>
      </div>
    </article>`).join('') || '<p class="empty">No activities match your preferences.</p>';
  localize(byId('activity-grid'));
}

function liveButton(mode, workout = '') {
  if (!nativeLive || !liveAvailable()) return '';
  const title = mode === 'cooking' ? 'Cooking coach' : 'Fitness coach';
  const action = `<button type="button" class="button light" data-live="${mode}" data-live-workout="${workout}">${t('Call Viera')}</button>`;
  return `<div class="live-entry"><div><p class="live-label">Gemini Live</p><strong>${t(title)}</strong></div>${action}</div>`;
}

function openLive(mode, workout) {
  if (!nativeLive || !liveAvailable() || (mode === 'cooking' && !selectedRecipe)) return;
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

function calorieGap(meal, portion, target) {
  if (!target) return '';
  const gap = calories(meal, portion) - target;
  const estimate = gap ? t(gap > 0 ? '{gap} kcal above target' : '{gap} kcal below target')
    .replace('{gap}', formatNumber.format(Math.abs(gap))) : t('Matches the estimated target');
  return `${t('Target')} ${formatNumber.format(target)} kcal · ${estimate}`;
}

function closestByCalories(meals, target) {
  return [...meals].sort((a, b) => Math.abs(calories(a) - target) - Math.abs(calories(b) - target));
}

function pathLabel(path) {
  return t(path === 'buy' ? 'Buy it nearby' : 'Cook it myself');
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
  const { meal, workout, focus, source, reason, localFailure, milliseconds, modelName, saved, closestMeal } = result;
  const portion = result.servings ?? 1;
  const headline = saved ? 'Your saved plan' : 'Suggested pairing';
  const mealAttributes = `data-recipe="${meal.id}" data-portion="${portion}"
    ${result.target ? `data-target="${result.target}"` : ''}
    ${result.vegetarian !== undefined ? `data-vegetarian="${result.vegetarian}"` : ''}
    ${saved ? '' : 'data-plan-meal'}`;
  const gap = calorieGap(meal, portion, result.target);
  let closest = '';
  if (closestMeal && calories(meal, portion) !== result.target) {
    const label = t('Closest available by estimated kcal');
    const closestGap = calorieGap(closestMeal, 1, result.target);
    closest = Math.abs(calories(closestMeal) - result.target) === Math.abs(calories(meal, portion) - result.target)
      ? label : `${label}: ${mealCopy(closestMeal).name} · ≈ ${calories(closestMeal)} kcal · ${closestGap}`;
  }
  byId('plan-result').innerHTML = `
    <div class="result" data-plan-source="${source}">
      <div class="result-heading"><h3 tabindex="-1">${headline}</h3><span class="source">${labels[source]}</span></div>
      <div class="pairing">
        <article class="pairing-meal">
          ${mealImage(meal)}
          <div class="pairing-meal-copy">
            <h4>${mealCopy(meal).name}</h4>
            <p class="metric"><span>${formatNumber.format(portion)} × ${t('serving')}</span><span class="energy-figure">≈ ${calories(meal, portion)} kcal</span><span>${meal.minutes} ${t('min')}</span></p>
            ${gap ? `<p class="hint" data-plan-gap>${gap}</p>` : ''}
            ${closest ? `<p class="hint" data-closest-meal>${closest}</p>` : ''}
            ${result.mealPath ? `<p class="hint" data-confirmed-path>${pathLabel(result.mealPath)}</p>` : ''}
            <div class="pairing-actions">
              <button class="button primary" type="button" ${mealAttributes} data-featured-path="cook">Cook it myself</button>
              <button class="button outline" type="button" ${mealAttributes} data-featured-path="buy">Buy it nearby</button>
            </div>
          </div>
        </article>
        <article class="pairing-workout">${movementArt(workout)}
          <div class="pairing-workout-copy"><p class="kicker">Movement</p><h4>${activityCopy(workout).name}</h4>
          <p class="metric"><strong class="energy-figure">≈ ${energyFor(workout)} kcal</strong><span>${workout.minutes} ${t('min')} · ${t(workout.intensity)}</span></p>
          <p class="hint">${movementEstimateBasis()}</p>
          <button class="button routine-link" type="button" data-workout="${workout.id}">See routine</button></div>
        </article>
      </div>
      ${explanations[focus] ? `<p class="hint">${explanations[focus]}</p>` : ''}
      ${result.localMovement ? '<p class="hint">Movement matched locally to your saved limits.</p>' : ''}
      ${saved ? '<button type="button" class="button light plan-save" data-complete-plan>Mark plan completed</button>' : '<button type="button" class="button light plan-save" data-save-draft>Save this pairing</button>'}
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

function revealPairing() {
  const heading = byId('plan-result').querySelector('h3');
  heading?.focus({ preventScroll: true });
  byId('plan-result').scrollIntoView({ block: 'start' });
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
  const model = nanoDownloadStatus();
  const canDownload = model && deviceStatus === 'downloadable';
  const downloading = model && (deviceStatus === 'downloading' || nanoStarting);
  const panel = byId('nano-download');
  const action = byId('download-nano');
  const error = model?.error ?? nanoStartError;
  panel.hidden = !(canDownload || downloading || (model && error && deviceStatus !== 'available'));
  action.hidden = !canDownload && !downloading;
  action.disabled = Boolean(downloading);
  let message = '';
  if (downloading) {
    message = model.totalBytes > 0
      ? t('Download progress {percent}').replace('{percent}', new Intl.NumberFormat(language, {
          style: 'percent'
        }).format(Math.min(1, model.downloadedBytes / model.totalBytes)))
      : t('Android is preparing the download.');
  } else if (error && deviceStatus !== 'available') {
    message = t({
      'device-download-network': 'Connect to unmetered internet before downloading.',
      'device-download-storage': 'Free up at least 4 GiB before downloading.',
      'device-download-timeout': 'The download check timed out. Check Android model status before trying again.'
    }[error] ?? 'The download could not finish. You can still use Offline Rules.');
  }
  const progress = byId('nano-progress');
  if (progress.textContent !== message) progress.textContent = message;
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

function updateStatus() {
  statusUpdate ??= (async () => {
    const hadLive = liveAvailable();
    deviceStatus = await checkDevice();
    if (deviceStatus === 'available') nanoStartError = undefined;
    if (hadLive !== liveAvailable()) byId('live-fitness-entry').innerHTML = liveButton('fitness');
    setDeviceLabel();
    toggleNetwork();
    clearTimeout(nanoPoll);
    if (nativeLive && deviceStatus === 'downloading' && !document.hidden) {
      nanoPoll = setTimeout(updateStatus, 2000);
    }
  })().finally(() => { statusUpdate = undefined; });
  return statusUpdate;
}

async function requestNanoDownload() {
  if (deviceStatus !== 'downloadable' || nanoStarting) return;
  nanoStarting = true;
  nanoStartError = undefined;
  setDeviceLabel();
  try {
    await startNanoDownload(true);
  } catch (error) {
    nanoStartError = error.message;
  } finally {
    nanoStarting = false;
    if (statusUpdate) await statusUpdate;
    await updateStatus();
  }
}

function renderSelection() {
  const manual = draft?.source === 'manual' ? draft : null;
  const panel = byId('plan-selection');
  panel.hidden = !manual;
  panel.innerHTML = manual ? `
    <h3 tabindex="-1">Your selections</h3>
    <p>${manual.meal ? `${mealCopy(manual.meal).name} · ${manual.servings} × ${t('serving')} · ≈ ${calories(manual.meal, manual.servings)} kcal` : 'Choose a recipe from Meals.'}</p>
    ${manual.mealPath ? `<p class="hint" data-confirmed-path>${pathLabel(manual.mealPath)}</p>` : ''}
    ${manual.meal && manual.target ? `<p class="hint" data-plan-gap>${calorieGap(manual.meal, manual.servings, manual.target)}</p>` : ''}
    <p>${manual.workout ? `${activityCopy(manual.workout).name} · ${manual.workout.minutes} ${t('min')}` : 'Choose an activity from Movement.'}</p>
    <button type="button" class="button primary" data-save-draft ${!manual.meal || !manual.workout ? 'disabled' : ''}>Save my plan</button>` : '';
  localize(panel);
}

function renderBuyRecovery(filter, profile) {
  const matches = mealMatches({ target: filter.target, cuisine: filter.cuisine }, profile)
    .filter(recipe => !filter.vegetarian || recipe.vegetarian);
  const meals = closestByCalories(matches, filter.target).slice(0, 3);
  const panel = byId('plan-selection');
  panel.hidden = false;
  panel.innerHTML = `
    <h3 tabindex="-1">${t('Find a meal to buy')}</h3>
    <p>${t(meals.length ? 'These meals match your filters. Choose a dish to check nearby menus.'
      : 'No meals in the library match your filters. Change a filter to continue.')}</p>
    ${meals.map((recipe, index) => `
      <button type="button" class="button outline purchase-option" data-recipe="${recipe.id}" data-featured-path="buy"
        data-target="${filter.target}" data-vegetarian="${filter.vegetarian}">
        <strong>${mealCopy(recipe).name}</strong>
        <small>≈ ${calories(recipe)} kcal · ${calorieGap(recipe, 1, filter.target)}</small>
        ${index === 0 && calories(recipe) !== filter.target ? `<small>${t('Closest available by estimated kcal')}</small>` : ''}
      </button>`).join('')}
    <button type="button" class="button light" data-adjust-plan>${t('Adjust your plan')}</button>`;
  panel.querySelector('h3').focus();
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
  const { meal, workout, source, servings: portion = 1, mealPath, target, vegetarian } = draft;
  state.plan = { meal: meal.id, workout: workout.id, servings: portion, source, mealPath, target, vegetarian };
  byId('plan-status').textContent = t(saveState(state) ? 'Plan saved on this device.' : 'Plan saved for this session.');
  draft = null;
  renderSelection();
  renderSaved();
  revealPairing();
}

async function buildPlan(event) {
  event.preventDefault();
  if (busy) return;
  const filter = { ...filters(), scenario: byId('scenario').value, vegetarian: byId('vegetarian').checked };
  const profile = recommendationProfile();
  const options = planOptions(filter, profile);
  const cloudOptions = planOptions(filter, demoProfile);
  const status = byId('plan-status');
  if (!options.mealOptions.length || !options.movementOptions.length) {
    draft = null;
    renderSelection();
    renderSaved();
    if (options.limits.noCook && !options.mealOptions.length) {
      status.textContent = t('No cook-at-home meals match your filters.');
      renderBuyRecovery(filter, profile);
    } else {
      status.textContent = t('These filters leave no pairing. Try a different day or cuisine.');
    }
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
    const result = {
      ...reply, target: options.target, vegetarian: options.vegetarian,
      closestMeal: closestByCalories(options.mealOptions, options.target)[0]
    };
    if (reply.source === 'catalog') {
      result.meal = options.mealOptions[0];
      result.workout = options.movementOptions[0];
    } else if (!options.movementOptions.some(workout => workout.id === reply.workout.id)) {
      // Cloud uses a synthetic profile. Enforce private constraints on the device.
      result.workout = options.movementOptions[0];
      result.localMovement = true;
    }
    draft = result;
    renderResult(result);
    const fallback = result.source === 'catalog' && reasons[result.reason] ? `${t(reasons[result.reason])} ` : '';
    status.textContent = `${fallback}${t('Review and save the pairing when ready.')}`;
    byId('plan-options').open = false;
    revealPairing();
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
  return `${mealImage(recipe, 'class="dialog-photo"')}
    <div class="dialog-inner">
    <p class="eyebrow">${t(recipe.origin)} · ${recipe.minutes} ${t('min')}</p><h2 id="dialog-heading">${recipe.name}</h2>
    <p class="subtle">${recipe.description}</p>
    <div class="portion"><label for="servings">Servings</label><select id="servings"><option value="0.5">½</option><option value="1" selected>1</option><option value="1.5">1½</option><option value="2">2</option><option value="3">3</option></select>
    <strong id="portion-energy">≈ ${calories(recipe, servings)} kcal</strong></div>
    <details class="nutrition-note"><summary>About recipe kcal</summary><p class="hint">Rounded to the nearest 5 kcal from recipe ingredient weights and reference values, including <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a>. Brands and preparation can change the total.</p>${recipe.fdc ? `<p class="hint"><a href="https://fdc.nal.usda.gov/download-datasets/" target="_blank" rel="noopener noreferrer">USDA SR Legacy: ${recipe.fdc.join(', ')}</a></p>` : ''}</details>
    <div class="meal-path" role="group" aria-label="How will you get this meal?">
      <button class="button outline" type="button" data-meal-path="cook" aria-pressed="true" aria-controls="cook-meal">Cook it myself</button>
      <button class="button outline" type="button" data-meal-path="buy" aria-pressed="false" aria-controls="buy-meal">Buy it nearby</button>
    </div>
    <div id="cook-meal">
    ${liveButton('cooking')}
    <section class="dialog-section"><h3>Shopping list</h3>
    <div class="grocery">${recipe.ingredients.map((item, index) => `
      <label class="check"><input type="checkbox" data-ingredient="${index}" ${grocery.includes(index) ? 'checked' : ''}>
      <span>${item.name} · <span data-grams="${item.grams}">${item.grams} g</span></span></label>`).join('')}</div>
    <details id="grocery-details"><summary>Where to shop</summary>${groceryPanel}</details></section>
    <section class="dialog-section"><h3>Cook step by step</h3>
    <ol class="cook-steps">${recipe.steps.map(([title, instruction]) => `<li><strong>${title}</strong><p>${instruction}</p></li>`).join('')}</ol>
    ${recipe.video ? `<p class="hint">${t('Reference video')} · ${recipe.creator}</p>
    <p><button class="button outline" data-video="${recipe.video}">Load cooking video</button>
    <a class="button outline" href="https://www.youtube.com/watch?v=${recipe.video}" target="_blank" rel="noopener noreferrer">Open on YouTube</a></p>
    <div class="video-frame"></div>` : ''}</section></div>
    ${nearbyPanel}
    <div class="dialog-section"><button type="button" class="button primary" data-select-meal>Add meal and choose movement</button></div></div>`;
}

function setMealPath(path) {
  mealPath = path;
  byId('buy-meal').hidden = path !== 'buy';
  byId('cook-meal').hidden = path !== 'cook';
  for (const button of dialog.querySelectorAll('[data-meal-path]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mealPath === path));
  }
  if (path === 'buy') nearbyActivate?.();
  else nearbyDispose?.();
  if (path === 'buy') groceries?.dispose();
  else if (byId('grocery-details').open) groceries?.activate();
}

function showRecipe(recipe, portion, selection, path = 'cook') {
  const content = byId('dialog-content');
  nearbyDispose?.();
  groceries?.dispose();
  mealSelection = selection;
  content.innerHTML = recipeDetails(mealCopy(recipe), portion);
  localize(content);
  const nearby = mountNearby(byId('buy-meal'), {
    recipe: selectedRecipe, getServings: () => servings,
    getOnline: () => navigator.onLine && connectionState() !== false,
    profile: state.profile, selection,
    onChoose: ({ recipe: substitute, portion: preferredPortion }, target) => {
      showRecipe(substitute, preferredPortion, { ...selection, target }, 'buy');
      content.scrollTop = 0;
      dialog.querySelector('[data-meal-path="buy"]').focus({ preventScroll: true });
    }
  });
  nearbyRefresh = nearby.refresh;
  nearbyActivate = nearby.activate;
  nearbyDispose = nearby.dispose;
  const grocerySearch = byId('grocery-search');
  const grocerySearchControls = mountNearby(grocerySearch, {
    grocery: true, getOnline: () => navigator.onLine && connectionState() !== false, selection: {}
  });
  groceries = grocerySearchControls;
  byId('grocery-details').addEventListener('toggle', event => {
    grocerySearch.hidden = !event.currentTarget.open;
    if (event.currentTarget.open && mealPath === 'cook') grocerySearchControls.activate();
    else grocerySearchControls.dispose();
  });
  byId('servings').value = String(servings);
  updateServing();
  setMealPath(path);
}

function openDetails(trigger, recipe, workout) {
  detailTrigger = trigger;
  selectedRecipe = null;
  mealSelection = undefined;
  nearbyDispose?.();
  nearbyDispose = undefined;
  nearbyActivate = undefined;
  nearbyRefresh = undefined;
  if (workout) workout = activityCopy(workout);
  if (recipe) {
    showRecipe(recipe, Number(trigger.dataset.portion), {
      target: Number(trigger.dataset.target) || undefined,
      vegetarian: trigger.dataset.vegetarian === undefined ? byId('vegetarian').checked : trigger.dataset.vegetarian === 'true',
      forDraft: trigger.hasAttribute('data-plan-meal')
    }, trigger.dataset.featuredPath ?? 'cook');
    if (trigger.dataset.featuredPath) rememberDraftPath();
  } else {
    byId('dialog-content').innerHTML = `${movementArt(workout)}<div class="dialog-inner">
    <p class="eyebrow">${t(workout.intensity)} · ${workout.minutes} ${t('min')}</p>
    <h2 id="dialog-heading">${workout.name}</h2>
    <p class="subtle"><strong class="energy-figure">≈ ${energyFor(workout)} kcal</strong><br>${movementEstimateBasis()}</p>
    <p class="hint">${t(workout.equipment === 'None' ? 'No equipment' : workout.equipment)}</p>
    <div class="dialog-section"><h3>Follow the routine</h3>
    ${liveButton('fitness', workout.id)}<ol>
    ${workout.steps.map(step => `<li>${step}</li>`).join('')}</ol>
    <button type="button" class="button primary" data-select-workout="${workout.id}">Add movement to my plan</button></div></div>`;
    localize(byId('dialog-content'));
  }
  dialog.showModal();
  byId('dialog-content').scrollTop = 0;
}

function rememberDraftPath() {
  if (busy || !mealSelection?.forDraft || draft?.meal?.id !== selectedRecipe.id || draft.mealPath === mealPath) return;
  draft.mealPath = mealPath;
  draftPathChanged = true;
}

function renderEnergyShortcuts() {
  const goal = Array.from(byId('goal').options).find(option => option.value === state.profile.goal);
  byId('goal-shortcut').textContent = goal?.textContent ?? '';
  byId('kcal-shortcut').textContent = `${formatNumber.format(filters().target)} kcal`;
}

function updateProfileForm() {
  for (const [id, property] of Object.entries({
    'preferred-cuisine': 'cuisine', taste: 'taste', intensity: 'intensity', movement: 'movement', goal: 'goal',
    equipment: 'equipment', 'activity-minutes': 'activityMinutes'
  })) byId(id).value = state.profile[property];
  byId('change').value = state.profile.change || '';
  byId('body-weight').value = state.profile.bodyWeight ?? '';
  byId('activity-target').value = state.profile.activityTarget ?? '';
  byId('low-impact').checked = state.profile.lowImpact;
  renderCompleted();
  updateGoalInput();
  renderEnergyShortcuts();
  const plan = habitPlan(state.profile.goal, state.profile.change);
  byId('habit-plan').innerHTML = plan
    ? `<div class="habit"><h3>${t(plan.title).replace('a goal to review', t('a goal to review'))}</h3><ol>${plan.weeks.map(week => `<li>${t(week)}</li>`).join('')}</ol></div>`
    : '';
}

function renderCompleted() {
  byId('completed-plans').innerHTML = state.completed.length ? `<details><summary>${t('Completed plans')}</summary><ul>${
    state.completed.map((plan, index) => `<li><time datetime="${plan.day}">${plan.day}</time> · ${
      mealCopy(recipes.find(recipe => recipe.id === plan.meal)).name} · ${
      activityCopy(workouts.find(workout => workout.id === plan.workout)).name}
      <button type="button" class="text-button" data-reopen-plan="${index}">${t('Use this plan again')}</button></li>`).join('')
  }</ul></details>` : '';
}

async function restoreCompletedHistory() {
  const reply = await nativeRequest('completed-history-read').catch(() => null);
  if (!Array.isArray(reply?.completed)) return;
  state.completed = normalizeCompletedPlans(reply.completed);
  renderCompleted();
  renderMeals();
  renderActivities();
}

async function writeCompletedHistory(completed) {
  const reply = await nativeRequest('completed-history-write', { completed }).catch(() => null);
  return reply?.saved === true;
}

async function markPlanCompleted() {
  if (historyBusy) return;
  historyBusy = true;
  try {
    await historyReady;
    const previous = state.completed;
    const added = recordCompletion(state);
    const saved = added && (nativeLive ? await writeCompletedHistory(state.completed) : saveState(state));
    if (added && nativeLive && !saved) {
      state.completed = previous;
      byId('plan-status').textContent = t('Could not save the completed plan. Try again.');
      return;
    }
    if (saved && nativeLive) saveState(state);
    byId('plan-status').textContent = t(!added ? 'Already marked completed today.'
      : saved ? 'Completed plan saved on this device.' : 'Completed plan saved for this session.');
    renderCompleted();
    renderMeals();
    renderActivities();
  } finally {
    historyBusy = false;
  }
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
    change: byId('change').disabled ? 0 : byId('change').valueAsNumber,
    bodyWeight: byId('body-weight').value ? byId('body-weight').valueAsNumber : null,
    activityTarget: byId('activity-target').value ? byId('activity-target').valueAsNumber : null,
    activityMinutes: Number(byId('activity-minutes').value), equipment: byId('equipment').value,
    lowImpact: byId('low-impact').checked
  };
  byId('profile-status').textContent = t(saveState(state) ? 'Preferences saved in this browser.' : 'Preferences updated for this session.');
  renderMeals();
  renderActivities();
  if (draft?.meal && draft?.workout && draft.source !== 'manual') renderResult(draft);
  else renderSaved();
  updateProfileForm();
}

document.addEventListener('click', event => {
  const trigger = event.target.closest('button');
  if (!trigger) return;
  if (trigger.dataset.mealPath) {
    setMealPath(trigger.dataset.mealPath);
    rememberDraftPath();
    return;
  }
  if (trigger.hasAttribute('data-adjust-plan')) {
    byId('plan-options').open = true;
    byId('scenario').focus();
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
  if (trigger.hasAttribute('data-complete-plan')) {
    void markPlanCompleted();
    return;
  }
  if (trigger.hasAttribute('data-reopen-plan')) {
    if (busy) return;
    const previous = state.completed[Number(trigger.dataset.reopenPlan)];
    if (!previous) return;
    draft = {
      ...previous, source: 'manual',
      meal: recipes.find(recipe => recipe.id === previous.meal),
      workout: workouts.find(workout => workout.id === previous.workout)
    };
    draftPathChanged = false;
    renderSelection();
    renderSaved();
    byId('plan-status').textContent = '';
    location.hash = 'daily-plan';
    byId('plan-selection').querySelector('h3').focus();
    return;
  }
  const selectingMeal = trigger.hasAttribute('data-select-meal');
  const selectingWorkout = trigger.dataset.selectWorkout;
  if ((selectingMeal || selectingWorkout) && !busy) {
    const current = draft ?? {};
    draft = selectingMeal
      ? { source: 'manual', meal: selectedRecipe, servings, workout: current.workout, mealPath,
          target: mealSelection.target, vegetarian: mealSelection.vegetarian }
      : { ...current, source: 'manual', workout: workouts.find(item => item.id === selectingWorkout) };
    draftPathChanged = false;
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
    const remaining = document.querySelector(`[${attribute}="${id}"]`);
    if (remaining) remaining.focus({ preventScroll: true });
    else if (like) (byId('recipe-grid').querySelector('[data-like]') ?? byId('favorites-only')).focus();
  }
  if (video && selectedRecipe?.video === video && navigator.onLine) {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${video}`;
    iframe.title = `${t('Cooking video')} · ${selectedRecipe.name}`;
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
  groceries?.dispose();
  groceries = undefined;
  if (dialog.open) return;
  nearbyDispose?.();
  nearbyDispose = undefined;
  nearbyActivate = undefined;
  nearbyRefresh = undefined;
  byId('dialog-content').replaceChildren();
  if (draftPathChanged) {
    draftPathChanged = false;
    renderResult(draft);
    detailTrigger = byId('plan-result').querySelector(`[data-featured-path="${detailTrigger.dataset.featuredPath}"]`);
  }
  detailTrigger?.focus({ preventScroll: true });
});
byId('meal-filter').addEventListener('submit', event => event.preventDefault());
byId('meal-kcal').addEventListener('input', () => { libraryTargetChosen = true; renderEnergyShortcuts(); });
byId('meal-filter').addEventListener('input', renderMeals);
byId('plan-form').addEventListener('submit', buildPlan);
byId('profile-form').addEventListener('submit', saveProfile);
byId('goal').addEventListener('change', updateGoalInput);
byId('reset-profile').addEventListener('click', async () => {
  if (busy || historyBusy || !confirm(t('Clear saved preferences, shopping checklists and the last plan from this browser?'))) return;
  historyBusy = true;
  try {
    await historyReady;
    if (nativeLive && !await writeCompletedHistory([])) {
      byId('profile-status').textContent = t('Local data could not be cleared. Try again.');
      return;
    }
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
  } finally {
    historyBusy = false;
  }
});

document.documentElement.lang = language;
byId('scenario').innerHTML = Object.entries(scenarios).map(([key, value]) =>
  `<option value="${key}">${key === 'late' ? 'Up to 25 minutes to cook' : value.label}</option>`).join('');
localize(document.body);
byId('featured-meal-title').textContent = mealCopy(recipes[0]).name;
byId('featured-meal-metrics').innerHTML = mealMetrics(recipes[0]);
const navigation = Array.from(document.querySelectorAll('.navigation a'));
const bar = document.querySelector('.navigation');
const sections = navigation.map(link => byId(link.hash.slice(1)));
const sideBySide = matchMedia('(min-width: 960px)');
let navigationFrame = 0;
function updateNavigation() {
  navigationFrame = 0;
  const active = sideBySide.matches
    ? navigation.find(link => link.hash === location.hash) ?? navigation[0]
    : navigation[sections.reduce((latest, section, index) => section.getBoundingClientRect().top <= 96 ? index : latest, 0)];
  for (const link of navigation) {
    if (link === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
function scheduleNavigation() {
  if (!navigationFrame) navigationFrame = requestAnimationFrame(updateNavigation);
}
addEventListener('hashchange', scheduleNavigation);
addEventListener('scroll', scheduleNavigation, { passive: true });
addEventListener('resize', scheduleNavigation);
updateNavigation();
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => document.documentElement.style.setProperty('--nav-clearance', `${bar.offsetHeight + 24}px`)).observe(bar);
}
function updateKeyboardClearance() {
  const editing = document.activeElement?.matches('input:not([type=checkbox]), textarea');
  const resized = window.visualViewport && window.innerHeight - window.visualViewport.height > 100;
  bar.classList.toggle('editing', Boolean(editing && (resized || nativeLive)));
}
document.addEventListener('focusin', updateKeyboardClearance);
document.addEventListener('focusout', () => requestAnimationFrame(updateKeyboardClearance));
window.visualViewport?.addEventListener('resize', updateKeyboardClearance);
renderMeals();
renderActivities();
byId('live-fitness-entry').innerHTML = liveButton('fitness');
updateProfileForm();
renderSelection();
renderSaved();
byId('plan-options').open = !state.plan;
toggleNetwork();
addEventListener('online', updateStatus);
addEventListener('offline', updateStatus);
for (const event of ['online', 'offline']) addEventListener(event, () => {
  nearbyRefresh?.();
  if (mealPath === 'cook') groceries?.refresh();
});
addEventListener('focus', updateStatus);
byId('download-nano').addEventListener('click', requestNanoDownload);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(nanoPoll);
  else if (nativeLive) updateStatus();
});
loadConfig().then(updateStatus);
if ('serviceWorker' in navigator && !navigator.userAgent.includes('VieraAndroid/1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
