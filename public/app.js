const pinStorageKey = 'places_pin';
let sessionPin = '';
let places = [];
let userLocation = null;
let selectedPlace = null;
let locationLabel = '';

const geoModal = document.getElementById('geo-modal');
const geoRetry = document.getElementById('geo-retry');
const geoError = document.getElementById('geo-error');

const pinModal = document.getElementById('pin-modal');
const pinInput = document.getElementById('pin-input');
const pinRemember = document.getElementById('pin-remember');
const pinSave = document.getElementById('pin-save');
const pinError = document.getElementById('pin-error');
const changePin = document.getElementById('change-pin');
const syncStatus = document.getElementById('sync-status');
const locationPill = document.getElementById('location-pill');

const form = document.getElementById('place-form');
const searchQueryInput = document.getElementById('search-query');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
const searchHint = document.getElementById('search-hint');
const selectedName = document.getElementById('selected-name');
const selectedAddress = document.getElementById('selected-address');
const selectedMap = document.getElementById('selected-map');
const noteInput = document.getElementById('place-note');
const tagsInput = document.getElementById('place-tags');
const saveButton = document.getElementById('save-place');
const formHint = document.getElementById('form-hint');

const placesContainer = document.getElementById('places');
const filterInput = document.getElementById('filter');
const placeTemplate = document.getElementById('place-template');
const resultTemplate = document.getElementById('result-template');

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
  pinError.textContent = '';
  setTimeout(() => pinInput.focus(), 50);
}

function closePinModal() {
  pinModal.classList.remove('active');
  pinModal.setAttribute('aria-hidden', 'true');
}

function openGeoModal(message) {
  geoModal.classList.add('active');
  geoModal.setAttribute('aria-hidden', 'false');
  geoError.textContent = message || '';
}

function closeGeoModal() {
  geoModal.classList.remove('active');
  geoModal.setAttribute('aria-hidden', 'true');
  geoError.textContent = '';
}

function setStatus(text) {
  syncStatus.textContent = text;
}

function setLocationLabel(text) {
  locationLabel = text;
  if (!text) {
    locationPill.hidden = true;
    locationPill.textContent = '';
    return;
  }
  locationPill.textContent = `Near ${text}`;
  locationPill.hidden = false;
}

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
  if (!userLocation) {
    placesContainer.innerHTML = '';
    const empty = document.createElement('p');
    empty.textContent = 'Location required to show saved places.';
    empty.className = 'form-hint';
    placesContainer.appendChild(empty);
    return;
  }

  const query = filterInput.value.trim().toLowerCase();
  placesContainer.innerHTML = '';

  const enriched = places.map((place) => ({
    ...place,
    distanceMi: distanceMiles(userLocation, { lat: place.lat, lng: place.lng })
  }));

  const filtered = enriched.filter((place) => {
    const haystack = `${place.name} ${place.tags || ''} ${place.address || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  filtered.sort((a, b) => a.distanceMi - b.distanceMi);

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = query ? 'No matches yet.' : 'No places saved yet. Add one above.';
    empty.className = 'form-hint';
    placesContainer.appendChild(empty);
    return;
  }

  filtered.forEach((place, index) => {
    const node = placeTemplate.content.cloneNode(true);
    const root = node.querySelector('.place');
    const title = node.querySelector('.place-title');
    const meta = node.querySelector('.place-meta');
    const address = node.querySelector('.place-address');
    const note = node.querySelector('.place-note');
    const tags = node.querySelector('.place-tags');
    const openLink = node.querySelector('a');
    const delBtn = node.querySelector('button');

    root.style.animationDelay = `${index * 40}ms`;
    title.textContent = place.name;
    meta.textContent = `Saved ${formatDate(place.createdAt)} • ${formatDistance(place.distanceMi)}`;
    address.textContent = place.address;
    openLink.href = place.mapsUrl;

    if (place.note) {
      note.textContent = place.note;
    } else {
      note.style.display = 'none';
    }

    tags.innerHTML = '';
    if (place.tags) {
      place.tags.split(',').map((tag) => tag.trim()).filter(Boolean).forEach((tag) => {
        const chip = document.createElement('span');
        chip.textContent = tag;
        tags.appendChild(chip);
      });
    }

    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this place?')) return;
      try {
        await apiFetch(`/api/places/${place.id}`, { method: 'DELETE' });
        places = places.filter((p) => p.id !== place.id);
        renderPlaces();
        setStatus('Deleted');
      } catch (err) {
        setStatus('Delete failed');
      }
    });

    placesContainer.appendChild(node);
  });
}

function setSelectedPlace(place) {
  selectedPlace = place;
  if (!place) {
    selectedName.textContent = 'No place selected yet.';
    selectedAddress.textContent = '';
    selectedMap.removeAttribute('href');
    selectedMap.style.display = 'none';
    saveButton.disabled = true;
    return;
  }

  selectedName.textContent = place.name;
  selectedAddress.textContent = place.address;
  selectedMap.href = place.mapsUrl;
  selectedMap.style.display = 'inline-flex';
  saveButton.disabled = false;
}

function renderSearchResults(results) {
  searchResults.innerHTML = '';
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'form-hint';
    empty.textContent = 'No results found.';
    searchResults.appendChild(empty);
    return;
  }

  results.forEach((result) => {
    const distanceMi = distanceMiles(userLocation, { lat: result.lat, lng: result.lng });
    const node = resultTemplate.content.cloneNode(true);
    const title = node.querySelector('.result-title');
    const address = node.querySelector('.result-address');
    const distance = node.querySelector('.result-distance');
    const openLink = node.querySelector('a');
    const selectBtn = node.querySelector('button');

    title.textContent = result.name;
    address.textContent = result.address;
    distance.textContent = formatDistance(distanceMi);
    openLink.href = result.mapsUrl;

    selectBtn.addEventListener('click', () => {
      setSelectedPlace({ ...result });
    });

    searchResults.appendChild(node);
  });
}

async function loadPlaces() {
  if (!userLocation) {
    openGeoModal('Location is required to load saved places.');
    return;
  }

  try {
    setStatus('Syncing');
    await loadLocationName();
    places = await apiFetch('/api/places');
    renderPlaces();
    setStatus('Synced');
  } catch (err) {
    if (err.message === 'PIN required') {
      setStatus('Waiting for PIN');
      return;
    }
    openGeoModal(err.message);
    setStatus('Location error');
  }
}

async function runSearch() {
  if (!userLocation) {
    openGeoModal('Location is required to search nearby places.');
    return;
  }
  if (!locationLabel) {
    openGeoModal('Location lookup failed. Retry location.');
    return;
  }

  const query = searchQueryInput.value.trim();
  if (!query) {
    searchHint.textContent = 'Enter a search term.';
    return;
  }

  searchHint.textContent = '';
  formHint.textContent = '';
  setStatus('Searching');
  try {
    const params = new URLSearchParams({
      query,
      lat: userLocation.lat.toString(),
      lng: userLocation.lng.toString()
    });
    const results = await apiFetch(`/api/search?${params.toString()}`);
    renderSearchResults(results);
    setStatus('Search ready');
  } catch (err) {
    searchHint.textContent = err.message;
    setStatus('Search failed');
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

async function ensureLocation() {
  try {
    const position = await requestLocation();
    userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    setLocationLabel('');
    closeGeoModal();
    renderPlaces();
    return true;
  } catch (err) {
    openGeoModal('Location permission is required. Enable it and retry.');
    return false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedPlace) {
    formHint.textContent = 'Select a place before saving.';
    return;
  }

  const note = noteInput.value.trim();
  const tags = tagsInput.value.trim();
  formHint.textContent = '';

  try {
    const saved = await apiFetch('/api/places', {
      method: 'POST',
      body: JSON.stringify({
        name: selectedPlace.name,
        mapsUrl: selectedPlace.mapsUrl,
        placeId: selectedPlace.placeId,
        address: selectedPlace.address,
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        note,
        tags
      })
    });
    places.unshift(saved);
    renderPlaces();
    form.reset();
    setSelectedPlace(null);
    searchResults.innerHTML = '';
    searchQueryInput.value = '';
    setStatus('Saved');
  } catch (err) {
    formHint.textContent = err.message;
    setStatus('Save failed');
  }
});

searchButton.addEventListener('click', runSearch);

searchQueryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    runSearch();
  }
});

filterInput.addEventListener('input', () => {
  renderPlaces();
});

pinSave.addEventListener('click', async () => {
  const pin = pinInput.value.trim();
  if (!pin) {
    pinError.textContent = 'Enter a PIN to continue.';
    return;
  }
  setPin(pin, pinRemember.checked);
  try {
    await loadPlaces();
    closePinModal();
  } catch (err) {
    pinError.textContent = 'PIN did not match. Try again.';
  }
});

changePin.addEventListener('click', () => {
  setPin('', false);
  openPinModal();
});

geoRetry.addEventListener('click', async () => {
  const ok = await ensureLocation();
  if (!ok) return;
  if (!currentPin()) {
    openPinModal();
  } else {
    loadPlaces();
  }
});

window.addEventListener('DOMContentLoaded', async () => {
  setSelectedPlace(null);
  const ok = await ensureLocation();
  if (!ok) return;
  if (!currentPin()) {
    openPinModal();
    return;
  }
  loadPlaces();
});
