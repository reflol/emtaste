import { errorResponse, getConfig, verifyPin } from '../_lib/api.js';

const SEARCH_RADIUS_METERS = 8000;
const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

function buildMapsUrl(placeId, name, address) {
  const query = encodeURIComponent(`${name} ${address}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
}

export async function onRequestGet(context) {
  let config;
  try {
    config = getConfig(context.env);
  } catch (err) {
    return errorResponse(err.message, 500);
  }

  const auth = verifyPin(context.request, config.appPin);
  if (!auth.ok) return auth.response;

  const url = new URL(context.request.url);
  const query = (url.searchParams.get('query') || '').trim();
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));

  if (!query) {
    return errorResponse('query is required', 400);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return errorResponse('lat and lng are required', 400);
  }

  const response = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.mapsKey,
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
    return errorResponse('Google Maps search failed', 502);
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
      return errorResponse('Google Maps search response missing data', 502);
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
