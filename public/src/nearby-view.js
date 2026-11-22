import { calories, mapsUrl } from './planner.js';
import { language, t } from './locales.js';
import { displayMeal } from './catalog-locales.js';
import { benThanh, deviceSearchPoint, distanceKm, isPoint, manualArea, nearbyAlternatives, nearbyPlaces, nearbySearchUrl } from './nearby.js';
import { findAreas, findPossiblePlaces, osmAttribution } from './nearby-discovery.js';

export const nearbyPanel = `
  <section id="buy-meal" class="dialog-section nearby" aria-labelledby="nearby-heading" hidden>
    <h3 id="nearby-heading">Find ready-made food</h3>
    <details class="nearby-location" open>
      <summary>Choose search area</summary>
      <p class="hint">Precise location improves distance estimates. Viera reads your location once and does not save it.</p>
      <div class="nearby-location-actions">
        <button class="button outline" type="button" data-nearby-location="precise">Use precise location</button>
        <button class="button outline" type="button" data-nearby-location="approximate">Use approximate location</button>
      </div>
      <form class="nearby-area">
        <label for="nearby-area">Neighborhood, landmark or coordinates</label>
        <div><input id="nearby-area" type="text" maxlength="120" placeholder="Enter an area or latitude, longitude">
        <button class="button outline" type="submit">Use area</button></div>
        <p class="hint">Looking up a place name sends it to Photon. Use a public landmark instead of a private address.</p>
      </form>
      <div id="nearby-area-matches"></div>
      <button class="text-button nearby-landmark" type="button">Use Bến Thành Market, Ho Chi Minh City</button>
    </details>
    <label class="check"><input type="checkbox" id="nearby-vegetarian"> Vegetarian meal</label>
    <p class="hint" role="status" id="nearby-location-status"></p>
    <p class="nearby-energy" id="nearby-viera-energy"></p>
    <div id="nearby-online">
      <button type="button" class="button outline">Search open map data</button>
      <p class="hint">This sends an approximate search area and the food category to Photon. Venue records may have no menu.</p>
      <p class="hint" id="nearby-online-status" role="status"></p>
    </div>
    <div id="nearby-results"></div>
    <div class="nearby-map"></div>
  </section>`;

let requestNumber = 0;

function currentLocation(precise, signal) {
  const bridge = globalThis.VieraNative;
  if (bridge) {
    const id = `nearby-${++requestNumber}`;
    return new Promise((resolve, reject) => {
      const stop = () => {
        clearTimeout(timer);
        bridge.removeEventListener('message', receive);
        signal.removeEventListener('abort', cancel);
      };
      function cancel() {
        stop();
        try {
          bridge.postMessage(JSON.stringify({ id, operation: 'cancel-nearby-location' }));
        } catch {
          // Android also stops the fix when the activity closes or its timeout expires.
        }
        reject(new Error('location-unavailable'));
      }
      const timer = setTimeout(cancel, 60000);
      function receive(event) {
        const result = JSON.parse(event.data);
        if (result.id !== id) return;
        stop();
        if (result.reason) reject(new Error(result.reason));
        else resolve(result);
      }
      bridge.addEventListener('message', receive);
      signal.addEventListener('abort', cancel, { once: true });
      try {
        bridge.postMessage(JSON.stringify({ id, operation: 'nearby-location', precise }));
      } catch {
        stop();
        reject(new Error('location-unavailable'));
      }
    });
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('location-unavailable'));
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve({
      lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy,
      precise: precise && coords.accuracy <= 100
    }), error => reject(new Error(error.code === 1 ? 'location-denied' : 'location-unavailable')),
    { maximumAge: 0, timeout: precise ? 15000 : 9000, enableHighAccuracy: precise });
  });
}

const number = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });

function link(url, label, className = 'text-button') {
  return `<a class="${className}" href="${url.replaceAll('&', '&amp;')}" rel="noopener noreferrer">${t(label)}</a>`;
}

function venueList(places, online) {
  const list = document.createElement('ul');
  list.className = 'nearby-list nearby-venues';
  for (const place of places) {
    const card = document.createElement('li');
    card.innerHTML = `<div class="nearby-meta"><strong></strong><span class="nearby-distance"></span></div>
      <p class="nearby-address"></p><p class="nearby-dish"></p>
      <span class="nearby-evidence"></span><div class="nearby-actions"></div>`;
    card.querySelector('strong').textContent = place.name;
    card.querySelector('.nearby-distance').textContent = `${number.format(place.km)} km`;
    card.querySelector('.nearby-address').textContent = place.address;
    const description = card.querySelector('.nearby-dish');
    description.textContent = place.dish ? t(place.dish) : '';
    description.hidden = !place.dish;
    const evidence = card.querySelector('.nearby-evidence');
    evidence.classList.toggle('menu-verified', Boolean(place.menu));
    evidence.textContent = t(place.menu ? 'Listed on menu' : 'Possible match');
    if (online) card.querySelector('.nearby-actions').innerHTML =
      link(mapsUrl(`${place.lat},${place.lng}`, true), 'Directions', 'button primary')
      + link(place.menu ?? place.source, place.menu ? 'View menu' : 'View source');
    list.append(card);
  }
  return list;
}

export function mountNearby(panel, { recipe, getServings, getOnline, profile, selection, onChoose }) {
  const find = query => panel.querySelector(query);
  const locationControls = find('.nearby-location');
  const locationLabel = find('.nearby-location summary');
  const locationButtons = panel.querySelectorAll('[data-nearby-location]');
  const area = find('#nearby-area');
  const vegetarian = find('#nearby-vegetarian');
  const status = find('#nearby-location-status');
  const areaMatches = find('#nearby-area-matches');
  const energy = find('#nearby-viera-energy');
  const results = find('#nearby-results');
  const onlinePanel = find('#nearby-online');
  const searchOnline = find('#nearby-online button');
  const onlineStatus = find('#nearby-online-status');
  const maps = find('.nearby-map');
  const messages = {
    'location-denied': 'Location permission was denied. You can enter an area instead.',
    'location-unavailable': 'A location could not be read. Try entering an area.',
    'lookup-busy': 'The open map service is busy. Wait a moment, then try again.',
    'lookup-unavailable': 'The open map service is unavailable. Try coordinates or use Google Maps.'
  };
  let options = [];
  let lookup;
  let deviceLookup;
  const foundVenues = selection.foundVenues ??= new Map();
  area.value = selection.area ?? '';
  vegetarian.checked = selection.vegetarian;

  function showLocation(origin) {
    locationLabel.textContent = origin?.area || selection.area
      || (origin?.precise ? `${t('Device location selected')} · ±${number.format(Math.ceil(origin.accuracy))} m`
        : t(origin ? 'Approximate location selected' : 'Choose search area'));
    locationControls.open = !origin;
  }
  showLocation(selection.origin);

  function cancelLookup() {
    lookup?.abort();
    lookup = undefined;
    onlineStatus.textContent = '';
  }

  function cancelDeviceLookup() {
    deviceLookup?.abort();
    deviceLookup = undefined;
    locationButtons.forEach(button => { button.disabled = false; });
  }

  async function query(run, onResult, errorElement) {
    cancelLookup();
    const controller = new AbortController();
    lookup = controller;
    refresh();
    try {
      const found = await run(controller.signal);
      if (lookup === controller && panel.isConnected) onResult(found);
    } catch (error) {
      if (lookup === controller && panel.isConnected) {
        errorElement.textContent = t(messages[error.message] ?? messages['lookup-unavailable']);
      }
    } finally {
      if (lookup === controller) {
        lookup = undefined;
        refresh();
      }
    }
  }

  function refresh() {
    if (panel.hidden) return;
    const online = getOnline();
    const origin = selection.origin;
    const located = isPoint(origin);
    const conflictsWithDiet = vegetarian.checked && !recipe.vegetarian;
    const local = conflictsWithDiet ? [] : nearbyPlaces(recipe.id, origin);
    const discovered = conflictsWithDiet ? [] : foundVenues.get(recipe.id) ?? [];
    const places = [...local, ...discovered.filter(place => !local.some(known =>
      distanceKm(known, place) < 0.03))].slice(0, 5);
    const confirmed = local.some(place => place.menu);
    const target = selection.target ?? calories(recipe, getServings());
    options = confirmed ? [] : nearbyAlternatives({
      selected: recipe.id, servings: getServings(), target, vegetarian: vegetarian.checked, profile, origin
    });
    const message = conflictsWithDiet ? 'The selected dish does not match the vegetarian filter.'
      : located
      ? confirmed ? 'Menu listings near this location. Check current availability before traveling.'
        : 'No menu match was verified within 5 km in our directory.'
      : 'Choose a point to search within 5 km.';
    energy.textContent = `${t('Viera recipe estimate')} · ≈ ${calories(recipe, getServings())} kcal`;
    results.innerHTML = `<div class="nearby-place-results"><p class="hint">${t(message)}</p>
      ${located ? `<p class="hint">${t('Distances are straight-line estimates. Travel distance may differ.')}</p>` : ''}
      </div>
      ${places.length ? `<p class="hint">${t('Restaurant nutrition: no published kcal verified. Check with the restaurant.')}</p>` : ''}
      ${places.length && vegetarian.checked ? `<p class="hint">${t('Check dietary ingredients with the restaurant before ordering.')}</p>` : ''}
      ${options.length ? `<h4>${t('Similar-energy dishes')}</h4>
        <p class="hint">${t('Target')} ≈ ${target} kcal. ${t('Estimates use Viera recipe portions. Restaurant portions and ingredients can differ.')}</p>
        <ul class="nearby-list">${options.map(({ recipe: option, portion, kcal, difference, confirmed }, index) => `
          <li><button class="plan-item" type="button" data-nearby-option="${index}"><strong>${displayMeal(option, language).name}</strong>
            <small>${number.format(portion)} × ${t('serving')} · ≈ ${kcal} kcal · ${t(difference <= 0.1 ? 'Within ±10%' : 'Outside ±10%')}</small>
            ${confirmed ? `<small>${t('Menu match nearby')}</small>` : ''}</button></li>`).join('')}</ul>`
        : confirmed ? `<p class="hint">${t('Estimates use Viera recipe portions. Restaurant portions and ingredients can differ.')}</p>` : ''}`;
    if (places.length) results.querySelector('.nearby-place-results').append(venueList(places, online));
    if (places.some(place => place.openData) || origin?.openData || areaMatches.childElementCount) {
      const credit = document.createElement('p');
      credit.className = 'hint';
      credit.innerHTML = online ? link(osmAttribution, '© OpenStreetMap contributors') : '© OpenStreetMap contributors';
      results.querySelector('.nearby-place-results').append(credit);
    }
    onlinePanel.hidden = !located || !online || conflictsWithDiet;
    searchOnline.disabled = Boolean(lookup) || foundVenues.has(recipe.id);
    if (foundVenues.has(recipe.id)) {
      onlineStatus.textContent = t(discovered.length ? 'Open map results are possible matches. Ask the restaurant about the dish.'
        : 'Open map data returned no related venues within 5 km.');
    }
    maps.innerHTML = online && conflictsWithDiet
      ? `<p class="hint">${t('Choose a vegetarian alternative to search for it in Maps.')}</p>`
      : online
        ? `${link(nearbySearchUrl(recipe, origin, language, vegetarian.checked), 'Search for this dish in Google Maps', 'button outline')}
        <p class="hint">${t('Maps results are outside Viera’s directory and may extend beyond 5 km. Maps receives the dish and selected search area when opened.')}</p>`
        : `<p class="hint" role="status">${t('Offline. You can still view the saved directory and calorie estimates. Connect to open Maps and menus.')}</p>`;
  }

  function useArea(origin) {
    cancelDeviceLookup();
    cancelLookup();
    foundVenues.clear();
    areaMatches.replaceChildren();
    selection.origin = origin;
    selection.area = origin ? area.value.trim() : '';
    showLocation(isPoint(origin) ? origin : null);
    if (isPoint(origin)) locationLabel.focus({ preventScroll: true });
    status.textContent = t(origin
      ? isPoint(origin) ? 'Search location set.' : 'Area set for Google Maps.'
      : 'Enter a place or valid coordinates.');
    refresh();
  }

  area.addEventListener('input', () => {
    cancelLookup();
    cancelDeviceLookup();
    areaMatches.replaceChildren();
    status.textContent = '';
    refresh();
  });
  find('.nearby-area').addEventListener('submit', event => {
    event.preventDefault();
    if (lookup) return;
    const origin = manualArea(area.value);
    useArea(origin);
    if (!origin || isPoint(origin) || !getOnline()) return;
    status.textContent = t('Looking up matching areas…');
    query(signal => findAreas(origin.area, signal), candidates => {
      status.textContent = t(candidates.length ? 'Select the point to use for the 5 km search.'
        : 'No matching area was found. Try adding a city or country.');
      for (const candidate of candidates) {
        const button = document.createElement('button');
        button.className = 'button outline';
        button.type = 'button';
        button.textContent = candidate.area;
        button.addEventListener('click', () => {
          area.value = candidate.area;
          useArea(candidate);
        });
        areaMatches.append(button);
      }
    }, status);
  });
  find('.nearby-landmark').addEventListener('click', () => {
    area.value = benThanh.area;
    useArea(benThanh);
  });
  async function searchDeviceLocation(precise) {
    if (deviceLookup) return;
    const controller = new AbortController();
    deviceLookup = controller;
    cancelLookup();
    locationButtons.forEach(button => { button.disabled = true; });
    status.textContent = t('Getting your device location…');
    refresh();
    try {
      const fix = await currentLocation(precise, controller.signal);
      if (!panel.isConnected || deviceLookup !== controller) return;
      const origin = deviceSearchPoint(fix, precise);
      if (!origin) throw new Error('location-unavailable');
      area.value = '';
      useArea(origin);
      if (precise && !origin.precise) status.textContent = t('Only approximate location was available. The search point was adjusted.');
    } catch (error) {
      if (!panel.isConnected || deviceLookup !== controller) return;
      status.textContent = t(messages[error.message] ?? messages['location-unavailable']);
    } finally {
      if (deviceLookup === controller) cancelDeviceLookup();
    }
  }
  for (const button of locationButtons) {
    button.addEventListener('click', () => searchDeviceLocation(button.dataset.nearbyLocation === 'precise'));
  }
  vegetarian.addEventListener('change', () => {
    selection.vegetarian = vegetarian.checked;
    refresh();
  });
  searchOnline.addEventListener('click', () => {
    if (lookup || foundVenues.has(recipe.id) || !getOnline()) return;
    query(signal => findPossiblePlaces(recipe.id, selection.origin, signal),
      places => foundVenues.set(recipe.id, places), onlineStatus);
    onlineStatus.textContent = t('Searching open map data…');
  });
  results.addEventListener('click', event => {
    const option = event.target.closest('[data-nearby-option]');
    if (option) onChoose(options[Number(option.dataset.nearbyOption)], targetForChoice());
  });
  function targetForChoice() {
    return selection.target ?? calories(recipe, getServings());
  }
  return { refresh, dispose() { cancelLookup(); cancelDeviceLookup(); } };
}
