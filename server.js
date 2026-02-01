import crypto from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const appPin = (process.env.APP_PIN || '').trim();
if (!/^\d{6}$/.test(appPin)) {
  console.error('[places] APP_PIN must be exactly 6 digits.');
  process.exit(1);
}
const pinHash = crypto.createHash('sha256').update(appPin).digest();

const mapsApiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
if (!mapsApiKey) {
  console.error('[places] GOOGLE_MAPS_API_KEY is required. Set it in the environment.');
  process.exit(1);
}

const SEARCH_RADIUS_METERS = 8000;
const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const dataDir = join(import.meta.dir, 'data');
const dataFile = join(dataDir, 'places.json');
mkdirSync(dataDir, { recursive: true });

const publicDir = join(import.meta.dir, 'public');
const indexFile = Bun.file(join(publicDir, 'index.html'));

let store = { places: [] };

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validatePlace(place) {
  if (!place || typeof place !== 'object') {
    return 'Place entry is not an object.';
  }
  const requiredStrings = ['id', 'name', 'mapsUrl', 'placeId', 'address'];
  for (const field of requiredStrings) {
    if (typeof place[field] !== 'string' || place[field].trim() === '') {
      return `Missing or invalid ${field}.`;
    }
  }
  if (typeof place.note !== 'string' || typeof place.tags !== 'string') {
    return 'Missing or invalid note/tags.';
  }
  if (!isFiniteNumber(place.lat) || !isFiniteNumber(place.lng)) {
    return 'Missing or invalid lat/lng.';
  }
  if (!isFiniteNumber(place.createdAt)) {
    return 'Missing or invalid createdAt.';
  }
  return '';
}

function loadStore() {
  if (!existsSync(dataFile)) {
    store = { places: [] };
    saveStore();
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(dataFile, 'utf8'));
  } catch (err) {
    console.error('[places] Invalid JSON in data file. Fix or delete the file.');
    process.exit(1);
  }

  if (!parsed || !Array.isArray(parsed.places)) {
    console.error('[places] Invalid data file structure. Expected { places: [] }.');
    process.exit(1);
  }

  for (const place of parsed.places) {
    const error = validatePlace(place);
    if (error) {
      console.error(`[places] Invalid place entry. ${error}`);
      process.exit(1);
    }
  }

  store = parsed;
}

function saveStore() {
  const tempFile = `${dataFile}.tmp`;
  writeFileSync(tempFile, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tempFile, dataFile);
}

function buildMapsUrl(placeId, name, address) {
  const query = encodeURIComponent(`${name} ${address}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
}

function verifyPin(request) {
  const pin = (request.headers.get('x-pin') || '').trim();
  if (!pin) {
    return { ok: false, status: 401, message: 'PIN required' };
  }
  const hash = crypto.createHash('sha256').update(pin).digest();
  if (hash.length !== pinHash.length || !crypto.timingSafeEqual(hash, pinHash)) {
    return { ok: false, status: 403, message: 'Invalid PIN' };
  }
  return { ok: true };
}

async function serveStatic(pathname) {
  if (pathname === '/') {
    return new Response(indexFile);
  }

  const requested = pathname.replace(/^\/+/, '');
  const resolved = resolve(publicDir, requested);
  if (!resolved.startsWith(publicDir)) {
    return new Response('Not found', { status: 404 });
  }

  const file = Bun.file(resolved);
  if (await file.exists()) {
    return new Response(file);
  }

  const leaf = pathname.split('/').pop() || '';
  if (leaf.includes('.')) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(indexFile);
}

loadStore();

Bun.serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/api/health') {
      return Response.json({ ok: true });
    }

    if (pathname.startsWith('/api/')) {
      const auth = verifyPin(request);
      if (!auth.ok) {
        return Response.json({ error: auth.message }, { status: auth.status });
      }

      if (pathname === '/api/search' && request.method === 'GET') {
        const query = (url.searchParams.get('query') || '').trim();
        const lat = Number(url.searchParams.get('lat'));
        const lng = Number(url.searchParams.get('lng'));

        if (!query) {
          return Response.json({ error: 'query is required' }, { status: 400 });
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return Response.json({ error: 'lat and lng are required' }, { status: 400 });
        }

        const response = await fetch(PLACES_TEXT_SEARCH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': mapsApiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
          },
          body: JSON.stringify({
            textQuery: query,
            locationBias: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: SEARCH_RADIUS_METERS
              }
            }
          })
        });

        if (!response.ok) {
          const detail = await response.text();
          console.error('[places] Google Maps search failed:', detail);
          return Response.json({ error: 'Google Maps search failed' }, { status: 502 });
        }

        const data = await response.json();
        const rawPlaces = Array.isArray(data.places) ? data.places : [];
        const results = [];

        for (const place of rawPlaces) {
          const placeId = place.id;
          const name = place.displayName?.text;
          const address = place.formattedAddress;
          const location = place.location;
          const latValue = location?.latitude;
          const lngValue = location?.longitude;

          if (!placeId || !name || !address || !Number.isFinite(latValue) || !Number.isFinite(lngValue)) {
            console.error('[places] Search response missing required fields.');
            return Response.json({ error: 'Google Maps search response missing data' }, { status: 502 });
          }

          results.push({
            placeId,
            name,
            address,
            lat: latValue,
            lng: lngValue,
            mapsUrl: buildMapsUrl(placeId, name, address)
          });
        }

        return Response.json(results);
      }

      if (pathname === '/api/location' && request.method === 'GET') {
        const lat = Number(url.searchParams.get('lat'));
        const lng = Number(url.searchParams.get('lng'));

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return Response.json({ error: 'lat and lng are required' }, { status: 400 });
        }

        const response = await fetch(`${GEOCODE_URL}?latlng=${lat},${lng}&key=${mapsApiKey}`);
        if (!response.ok) {
          const detail = await response.text();
          console.error('[places] Geocoding failed:', detail);
          return Response.json({ error: 'Geocoding failed' }, { status: 502 });
        }

        const data = await response.json();
        if (data.status !== 'OK' || !Array.isArray(data.results) || !data.results[0]?.formatted_address) {
          console.error('[places] Geocoding response missing address.', data.status);
          return Response.json({ error: 'Geocoding response missing address' }, { status: 502 });
        }

        return Response.json({ label: data.results[0].formatted_address });
      }

      if (pathname === '/api/places' && request.method === 'GET') {
        return Response.json(store.places);
      }

      if (pathname === '/api/places' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch (err) {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const name = body?.name ? String(body.name).trim() : '';
        const mapsUrl = body?.mapsUrl ? String(body.mapsUrl).trim() : '';
        const placeId = body?.placeId ? String(body.placeId).trim() : '';
        const address = body?.address ? String(body.address).trim() : '';
        const note = body?.note ? String(body.note).trim() : '';
        const tags = body?.tags ? String(body.tags).trim() : '';
        const lat = Number(body?.lat);
        const lng = Number(body?.lng);

        if (!name || !mapsUrl || !placeId || !address) {
          return Response.json({ error: 'name, mapsUrl, placeId, and address are required' }, { status: 400 });
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return Response.json({ error: 'lat and lng are required' }, { status: 400 });
        }

        const place = {
          id: crypto.randomUUID(),
          name,
          mapsUrl,
          placeId,
          address,
          lat,
          lng,
          note,
          tags,
          createdAt: Date.now()
        };
        const error = validatePlace(place);
        if (error) {
          return Response.json({ error: `Invalid place data. ${error}` }, { status: 400 });
        }
        store.places.push(place);
        saveStore();
        return Response.json(place, { status: 201 });
      }

      if (pathname.startsWith('/api/places/') && request.method === 'DELETE') {
        const id = pathname.split('/')[3];
        if (!id) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }
        const before = store.places.length;
        store.places = store.places.filter((place) => place.id !== id);
        if (store.places.length === before) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }
        saveStore();
        return Response.json({ ok: true });
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (request.method === 'GET') {
      return serveStatic(pathname);
    }

    return new Response('Method not allowed', { status: 405 });
  }
});

console.log('[places] listening on http://localhost:3000');
