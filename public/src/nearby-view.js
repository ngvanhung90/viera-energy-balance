import { calories, mapsUrl } from './planner.js';
import { language, t } from './locales.js';
import { displayMeal } from './catalog-locales.js';
import { benThanh, isPoint, manualArea, nearbyAlternatives, nearbyPlaces, nearbySearchUrl } from './nearby.js';

export const nearbyPanel = `
  <section id="buy-meal" class="dialog-section nearby" aria-labelledby="nearby-heading" hidden>
    <h3 id="nearby-heading">Find ready-made food</h3>
    <details class="nearby-location" open>
      <summary>Choose search area</summary>
      <p class="hint">Your location is used once to compare distances and is not saved.</p>
      <button class="button outline" type="button" data-nearby-location>Use approximate location</button>
      <form class="nearby-area">
        <label for="nearby-area">Neighborhood, landmark or coordinates</label>
        <div><input id="nearby-area" type="text" maxlength="120" placeholder="Enter an area or latitude, longitude">
        <button class="button outline" type="submit">Use area</button></div>
      </form>
      <button class="text-button nearby-landmark" type="button">Use Bến Thành Market, Ho Chi Minh City</button>
    </details>
    <label class="check"><input type="checkbox" id="nearby-vegetarian"> Vegetarian meal</label>
    <p class="hint" role="status" id="nearby-location-status"></p>
    <div id="nearby-results"></div>
    <div class="nearby-map"></div>
  </section>`;

let requestNumber = 0;

function currentLocation() {
  const bridge = globalThis.VieraNative;
  if (bridge) {
    const id = `nearby-${++requestNumber}`;
    return new Promise((resolve, reject) => {
      const stop = () => {
        clearTimeout(timer);
        bridge.removeEventListener('message', receive);
      };
      const timer = setTimeout(() => {
        stop();
        reject(new Error('location-unavailable'));
      }, 60000);
      function receive(event) {
        const result = JSON.parse(event.data);
        if (result.id !== id) return;
        stop();
        if (result.reason) reject(new Error(result.reason));
        else resolve(result);
      }
      bridge.addEventListener('message', receive);
      try {
        bridge.postMessage(JSON.stringify({ id, operation: 'nearby-location' }));
      } catch {
        stop();
        reject(new Error('location-unavailable'));
      }
    });
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('location-unavailable'));
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve({
      lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy
    }), error => reject(new Error(error.code === 1 ? 'location-denied' : 'location-unavailable')),
    { maximumAge: 0, timeout: 9000, enableHighAccuracy: false });
  });
}

const number = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });

function link(url, label, className = 'text-button') {
  return `<a class="${className}" href="${url.replaceAll('&', '&amp;')}" rel="noopener noreferrer">${t(label)}</a>`;
}

export function mountNearby(panel, { recipe, getServings, getOnline, profile, selection, onChoose }) {
  const find = query => panel.querySelector(query);
  const locationControls = find('.nearby-location');
  const locationLabel = find('.nearby-location summary');
  const useLocation = find('[data-nearby-location]');
  const area = find('#nearby-area');
  const vegetarian = find('#nearby-vegetarian');
  const status = find('#nearby-location-status');
  const results = find('#nearby-results');
  const maps = find('.nearby-map');
  const messages = {
    'location-denied': 'Location permission was denied. You can enter an area instead.',
    'location-unavailable': 'A location could not be read. Try entering an area.'
  };
  let options = [];
  let locationUpdate = 0;
  area.value = selection.area ?? '';
  vegetarian.checked = selection.vegetarian;

  function showLocation(origin) {
    locationLabel.textContent = origin?.area || selection.area
      || t(origin ? 'Approximate location selected' : 'Choose search area');
    locationControls.open = !origin;
  }
  showLocation(selection.origin);

  function refresh() {
    if (panel.hidden) return;
    const online = getOnline();
    const origin = selection.origin;
    const located = isPoint(origin);
    const conflictsWithDiet = vegetarian.checked && !recipe.vegetarian;
    const places = conflictsWithDiet ? [] : nearbyPlaces(recipe.id, origin);
    const confirmed = places.some(place => place.menu);
    const target = selection.target ?? calories(recipe, getServings());
    options = confirmed ? [] : nearbyAlternatives({
      selected: recipe.id, servings: getServings(), target, vegetarian: vegetarian.checked, profile, origin
    });
    const message = located
      ? confirmed ? 'Menu listings near this location. Check current availability before traveling.'
        : 'No menu match was verified within 5 km in our directory.'
      : 'Choose a location to check the 5 km directory. Other area names can be searched in Maps.';
    results.innerHTML = `<p class="hint">${t(message)}</p>
      ${located ? `<p class="hint">${t('Distances are straight-line estimates. Travel distance may differ.')}</p>` : ''}
      ${places.length ? `<ul class="nearby-list">${places.map(place => `
        <li><div class="nearby-meta"><strong>${place.name}</strong><span>${number.format(place.km)} km</span></div>
          <p>${place.address}</p><p>${t(place.dish)} · ${t(place.menu ? 'Listed on menu' : 'Possible match')}</p>
          <div class="nearby-actions">${online ? link(mapsUrl(`${place.lat},${place.lng}`, true), 'Directions') : ''}
            ${online ? link(place.menu ?? place.source, place.menu ? 'View menu' : 'View source') : ''}</div></li>`).join('')}</ul>` : ''}
      ${options.length ? `<h4>${t('Similar-energy dishes')}</h4>
        <p class="hint">${t('Target')} ≈ ${target} kcal. ${t('Estimates use Viera recipe portions. Restaurant portions and ingredients can differ.')}</p>
        <ul class="nearby-list">${options.map(({ recipe: option, portion, kcal, difference, confirmed }, index) => `
          <li><button class="plan-item" type="button" data-nearby-option="${index}"><strong>${displayMeal(option, language).name}</strong>
            <small>${number.format(portion)} × ${t('serving')} · ≈ ${kcal} kcal · ${t(difference <= 0.1 ? 'Within ±10%' : 'Outside ±10%')}</small>
            ${confirmed ? `<small>${t('Menu match nearby')}</small>` : ''}</button></li>`).join('')}</ul>`
        : confirmed ? `<p class="hint">${t('Estimates use Viera recipe portions. Restaurant portions and ingredients can differ.')}</p>` : ''}`;
    maps.innerHTML = online && conflictsWithDiet
      ? `<p class="hint">${t('Choose a vegetarian alternative to search for it in Maps.')}</p>`
      : online
        ? `${link(nearbySearchUrl(recipe, origin, language, vegetarian.checked), 'Search for this dish in Google Maps', 'button outline')}
        <p class="hint">${t('Maps results are outside Viera’s directory and may extend beyond 5 km. Maps receives the dish and selected search area when opened.')}</p>`
        : `<p class="hint" role="status">${t('Offline. You can still view the saved directory and calorie estimates. Connect to open Maps and menus.')}</p>`;
  }

  function useArea(origin) {
    locationUpdate++;
    useLocation.disabled = false;
    selection.origin = origin;
    selection.area = origin ? area.value.trim() : '';
    showLocation(origin);
    if (origin) locationLabel.focus({ preventScroll: true });
    status.textContent = t(origin
      ? isPoint(origin) ? 'Search location set.' : 'Area set for Google Maps.'
      : 'Enter a place or valid coordinates.');
    refresh();
  }

  find('.nearby-area').addEventListener('submit', event => {
    event.preventDefault();
    useArea(manualArea(area.value));
  });
  find('.nearby-landmark').addEventListener('click', () => {
    area.value = benThanh.area;
    useArea(benThanh);
  });
  useLocation.addEventListener('click', async () => {
    const request = ++locationUpdate;
    useLocation.disabled = true;
    status.textContent = t('Looking up your approximate location…');
    try {
      const origin = await currentLocation();
      if (!panel.isConnected || request !== locationUpdate) return;
      if (!isPoint(origin)) throw new Error('location-unavailable');
      area.value = '';
      useArea(origin);
    } catch (error) {
      if (!panel.isConnected || request !== locationUpdate) return;
      status.textContent = t(messages[error.message] ?? messages['location-unavailable']);
    } finally {
      if (request === locationUpdate) useLocation.disabled = false;
    }
  });
  vegetarian.addEventListener('change', () => {
    selection.vegetarian = vegetarian.checked;
    refresh();
  });
  results.addEventListener('click', event => {
    const option = event.target.closest('[data-nearby-option]');
    if (option) onChoose(options[Number(option.dataset.nearbyOption)], targetForChoice());
  });
  function targetForChoice() {
    return selection.target ?? calories(recipe, getServings());
  }
  return refresh;
}
