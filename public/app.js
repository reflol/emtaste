const pinStorageKey = 'places_pin';
let sessionPin = '';
let places = [];
let userLocation = null;
let deferredInstall = null;
let locationDeniedNotified = false;

const geoModal = document.getElementById('geo-modal');
const geoRetry = document.getElementById('geo-retry');

const pinModal = document.getElementById('pin-modal');
const pinInput = document.getElementById('pin-input');
const pinRemember = document.getElementById('pin-remember');
const pinSave = document.getElementById('pin-save');
const pinButton = document.getElementById('pin-button');

const locationPill = document.getElementById('location-pill');

const form = document.getElementById('place-form');
const searchQueryInput = document.getElementById('search-query');
const searchResults = document.getElementById('search-results');
const formHint = document.getElementById('form-hint');

const placesContainer = document.getElementById('places');
const placeTemplate = document.getElementById('place-template');
const resultTemplate = document.getElementById('result-template');

let searchTimer = null;

function currentPin() {
  return sessionPin || localStorage.getItem(pinStorageKey) || '';
}

function setPin(pin, remember) {
  sessionPin = pin;
  if (remember) {
    localStorage.setItem(pinStorageKey, pin);
  } else {
    localStorage.removeItem(pinStorageKey);
  }
}

function openPinModal() {
  pinModal.classList.add('active');
  pinModal.setAttribute('aria-hidden', 'false');
  pinInput.value = '';
  pinInput.classList.remove('input-error');
  setTimeout(() => pinInput.focus(), 50);
}

function closePinModal() {
  pinModal.classList.remove('active');
  pinModal.setAttribute('aria-hidden', 'true');
}

function openGeoModal() {
  geoModal.classList.add('active');
  geoModal.setAttribute('aria-hidden', 'false');
}

function closeGeoModal() {
  geoModal.classList.remove('active');
  geoModal.setAttribute('aria-hidden', 'true');
}

function setLocationLabel(text) {
  if (!text) {
    locationPill.hidden = true;
    locationPill.textContent = '';
    return;
  }
  locationPill.textContent = text;
  locationPill.hidden = false;
}

function showPinError() {
  pinInput.classList.add('input-error');
  pinInput.value = '';
  pinInput.focus();
  setTimeout(() => pinInput.classList.remove('input-error'), 900);
}

function showPinHelp() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos) {
    alert('On iPhone: Share → Add to Home Screen.');
    return;
  }
  alert('Use your browser menu and choose “Add to Home screen.”');
}

function notifyLocationDenied(error) {
  if (!error || error.code !== 1 || locationDeniedNotified) {
    return;
  }
  locationDeniedNotified = true;
  alert('Location blocked. Enable it in browser settings for emtaste.com.');
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event;
});

pinButton.addEventListener('click', async () => {
  if (deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    return;
  }
  showPinHelp();
});

async function apiFetch(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const pin = currentPin();
  if (pin) headers['x-pin'] = pin;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    openPinModal();
    throw new Error('PIN required');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return response.json();
}

function formatDate(ts) {
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMiles(from, to) {
  const radius = 3958.8;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(value) {
  if (!Number.isFinite(value)) return '';
  return `${value.toFixed(1)} mi away`;
}

function renderPlaces() {
  placesContainer.innerHTML = '';

  if (!userLocation) {
    const empty = document.createElement('p');
    empty.textContent = 'Location required.';
    empty.className = 'form-hint';
    placesContainer.appendChild(empty);
    return;
  }

  const enriched = places.map((place) => ({
    ...place,
    distanceMi: distanceMiles(userLocation, { lat: place.lat, lng: place.lng })
  }));

  enriched.sort((a, b) => a.distanceMi - b.distanceMi);

  if (enriched.length === 0) {
    return;
  }

  enriched.forEach((place, index) => {
    const node = placeTemplate.content.cloneNode(true);
    const root = node.querySelector('.place');
    const title = node.querySelector('.place-title');
    const meta = node.querySelector('.place-meta');
    const address = node.querySelector('.place-address');
    const openLink = node.querySelector('a');
    const delBtn = node.querySelector('button');

    root.style.animationDelay = `${index * 40}ms`;
    title.textContent = place.name;
    meta.textContent = `Saved ${formatDate(place.createdAt)} • ${formatDistance(place.distanceMi)}`;
    address.textContent = place.address;
    openLink.href = place.mapsUrl;

    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this place?')) return;
      try {
        await apiFetch(`/api/places/${place.id}`, { method: 'DELETE' });
        places = places.filter((p) => p.id !== place.id);
        renderPlaces();
      } catch (err) {
        formHint.textContent = err.message;
      }
    });

    placesContainer.appendChild(node);
  });
}

async function savePlace(result) {
  try {
    formHint.textContent = '';
    const saved = await apiFetch('/api/places', {
      method: 'POST',
      body: JSON.stringify({
        name: result.name,
        mapsUrl: result.mapsUrl,
        placeId: result.placeId,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
        note: '',
        tags: ''
      })
    });
    places.unshift(saved);
    renderPlaces();
    searchResults.innerHTML = '';
    searchQueryInput.value = '';
  } catch (err) {
    formHint.textContent = err.message;
  }
}

function renderSearchResults(results) {
  searchResults.innerHTML = '';
  results.forEach((result) => {
    const distanceMi = distanceMiles(userLocation, { lat: result.lat, lng: result.lng });
    const node = resultTemplate.content.cloneNode(true);
    const title = node.querySelector('.result-title');
    const address = node.querySelector('.result-address');
    const distance = node.querySelector('.result-distance');
    const root = node.querySelector('.result');

    title.textContent = result.name;
    address.textContent = result.address;
    distance.textContent = formatDistance(distanceMi);

    root.addEventListener('click', () => {
      savePlace(result);
    });

    searchResults.appendChild(node);
  });
}

async function runSearch() {
  if (!userLocation) {
    openGeoModal();
    return;
  }

  const query = searchQueryInput.value.trim();
  if (query.length < 2) {
    searchResults.innerHTML = '';
    return;
  }

  try {
    formHint.textContent = '';
    const params = new URLSearchParams({
      query,
      lat: userLocation.lat.toString(),
      lng: userLocation.lng.toString()
    });
    const results = await apiFetch(`/api/search?${params.toString()}`);
    renderSearchResults(results);
  } catch (err) {
    formHint.textContent = err.message;
  }
}

async function requestLocation() {
  if (!navigator.geolocation) {
    throw new Error('Geolocation not supported in this browser.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function ensureLocation() {
  try {
    const position = await requestLocation();
    userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    closeGeoModal();
    renderPlaces();
    return true;
  } catch (err) {
    notifyLocationDenied(err);
    openGeoModal();
    return false;
  }
}

async function loadLocationName() {
  if (!userLocation) {
    throw new Error('Location is required to identify where you are.');
  }
  const params = new URLSearchParams({
    lat: userLocation.lat.toString(),
    lng: userLocation.lng.toString()
  });
  const data = await apiFetch(`/api/location?${params.toString()}`);
  if (!data || !data.label) {
    throw new Error('Location lookup failed. Check your Maps API key.');
  }
  setLocationLabel(data.label);
}

async function loadPlaces() {
  if (!userLocation) {
    openGeoModal();
    return;
  }

  try {
    await loadLocationName();
    places = await apiFetch('/api/places');
    renderPlaces();
  } catch (err) {
    if (err.message !== 'PIN required') {
      console.error(err);
      openGeoModal();
    }
  }
}

pinSave.addEventListener('click', async () => {
  const pin = pinInput.value.trim();
  if (!pin) {
    showPinError();
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    showPinError();
    return;
  }
  pinInput.blur();
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  setPin(pin, pinRemember.checked);
  try {
    await loadPlaces();
    closePinModal();
  } catch (err) {
    showPinError();
  }
});

geoRetry.addEventListener('click', async () => {
  const ok = await ensureLocation();
  if (!ok) return;
  if (!currentPin()) {
    openPinModal();
    return;
  }
  loadPlaces();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

searchQueryInput.addEventListener('input', () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 350);
});

searchQueryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    runSearch();
  }
});

pinInput.addEventListener('input', () => {
  pinInput.classList.remove('input-error');
});

window.addEventListener('DOMContentLoaded', async () => {
  const ok = await ensureLocation();
  if (!ok) return;
  if (!currentPin()) {
    openPinModal();
    return;
  }
  loadPlaces();
});
