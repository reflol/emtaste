const pinStorageKey = 'places_pin';
let sessionPin = '';
let places = [];
let nameTouched = false;

const modal = document.getElementById('pin-modal');
const pinInput = document.getElementById('pin-input');
const pinRemember = document.getElementById('pin-remember');
const pinSave = document.getElementById('pin-save');
const pinError = document.getElementById('pin-error');
const changePin = document.getElementById('change-pin');
const syncStatus = document.getElementById('sync-status');

const form = document.getElementById('place-form');
const mapsUrlInput = document.getElementById('maps-url');
const nameInput = document.getElementById('place-name');
const noteInput = document.getElementById('place-note');
const tagsInput = document.getElementById('place-tags');
const formHint = document.getElementById('form-hint');

const placesContainer = document.getElementById('places');
const searchInput = document.getElementById('search');
const template = document.getElementById('place-template');

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

function openModal() {
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  pinInput.value = '';
  pinError.textContent = '';
  setTimeout(() => pinInput.focus(), 50);
}

function closeModal() {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function setStatus(text) {
  syncStatus.textContent = text;
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const pin = currentPin();
  if (pin) headers['x-pin'] = pin;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    openModal();
    throw new Error('PIN required');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return response.json();
}

function parseNameFromMapsUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);
    const path = decodeURIComponent(url.pathname);
    const placeMatch = path.match(/\/maps\/place\/([^/]+)/);
    if (placeMatch) return cleanName(placeMatch[1]);

    const query = url.searchParams.get('q') || url.searchParams.get('query');
    if (query) return cleanName(query);
  } catch (err) {
    return '';
  }
  return '';
}

function cleanName(value) {
  return value.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(ts) {
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderPlaces() {
  const query = searchInput.value.trim().toLowerCase();
  placesContainer.innerHTML = '';

  const filtered = places.filter((place) => {
    const haystack = `${place.name} ${place.tags || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = query ? 'No matches yet.' : 'No places saved yet. Add one above.';
    empty.className = 'form-hint';
    placesContainer.appendChild(empty);
    return;
  }

  filtered.forEach((place, index) => {
    const node = template.content.cloneNode(true);
    const root = node.querySelector('.place');
    const title = node.querySelector('.place-title');
    const meta = node.querySelector('.place-meta');
    const note = node.querySelector('.place-note');
    const tags = node.querySelector('.place-tags');
    const openLink = node.querySelector('a');
    const delBtn = node.querySelector('button');

    root.style.animationDelay = `${index * 40}ms`;
    title.textContent = place.name;
    meta.textContent = `Saved ${formatDate(place.createdAt)}`;
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

async function loadPlaces() {
  try {
    setStatus('Syncing');
    places = await apiFetch('/api/places');
    renderPlaces();
    setStatus('Synced');
  } catch (err) {
    setStatus('Waiting for PIN');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const mapsUrl = mapsUrlInput.value.trim();
  const name = nameInput.value.trim();
  const note = noteInput.value.trim();
  const tags = tagsInput.value.trim();

  if (!mapsUrl || !name) {
    formHint.textContent = 'Please add both a Maps link and a name.';
    return;
  }

  formHint.textContent = '';
  try {
    const saved = await apiFetch('/api/places', {
      method: 'POST',
      body: JSON.stringify({ mapsUrl, name, note, tags })
    });
    places.unshift(saved);
    renderPlaces();
    form.reset();
    nameTouched = false;
    setStatus('Saved');
  } catch (err) {
    formHint.textContent = err.message;
    setStatus('Save failed');
  }
});

mapsUrlInput.addEventListener('input', () => {
  const rawUrl = mapsUrlInput.value.trim();
  if (!rawUrl) return;

  if (rawUrl.includes('maps.app.goo.gl') || rawUrl.includes('goo.gl/maps')) {
    formHint.textContent = 'Short link detected. Open it in a browser and copy the full URL for auto-name.';
  } else {
    formHint.textContent = '';
  }

  if (!nameTouched && !nameInput.value.trim()) {
    const suggested = parseNameFromMapsUrl(rawUrl);
    if (suggested) {
      nameInput.value = suggested;
    }
  }
});

nameInput.addEventListener('input', () => {
  nameTouched = true;
});

searchInput.addEventListener('input', () => {
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
    closeModal();
  } catch (err) {
    pinError.textContent = 'PIN did not match. Try again.';
  }
});

changePin.addEventListener('click', () => {
  setPin('', false);
  openModal();
});

window.addEventListener('DOMContentLoaded', () => {
  if (!currentPin()) {
    openModal();
  } else {
    loadPlaces();
  }
});
