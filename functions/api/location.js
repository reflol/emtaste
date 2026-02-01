import { errorResponse, getConfig, verifyPin } from '../_lib/api.js';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

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
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return errorResponse('lat and lng are required', 400);
  }

  const response = await fetch(`${GEOCODE_URL}?latlng=${lat},${lng}&key=${config.mapsKey}`);
  if (!response.ok) {
    const detail = await response.text();
    console.error('[places] Geocoding failed:', detail);
    return errorResponse('Geocoding failed', 502);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !Array.isArray(data.results) || !data.results[0]?.formatted_address) {
    console.error('[places] Geocoding response missing address.', data.status);
    return errorResponse('Geocoding response missing address', 502);
  }

  return Response.json({ label: data.results[0].formatted_address });
}
