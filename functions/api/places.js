import { errorResponse, getConfig, verifyPin } from '../_lib/api.js';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeRow(row) {
  return {
    id: row.id,
    name: row.name,
    mapsUrl: row.maps_url,
    placeId: row.place_id,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    note: row.note ?? '',
    tags: row.tags ?? '',
    createdAt: row.created_at
  };
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

  try {
    const result = await config.db
      .prepare(
        'SELECT id, name, maps_url, place_id, address, lat, lng, note, tags, created_at FROM places ORDER BY created_at DESC'
      )
      .all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return Response.json(rows.map(normalizeRow));
  } catch (err) {
    console.error('[places] Failed to load places from D1.', err);
    return errorResponse('Failed to load places', 502);
  }
}

export async function onRequestPost(context) {
  let config;
  try {
    config = getConfig(context.env);
  } catch (err) {
    return errorResponse(err.message, 500);
  }

  const auth = verifyPin(context.request, config.appPin);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await context.request.json();
  } catch (err) {
    return errorResponse('Invalid JSON body', 400);
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
    return errorResponse('name, mapsUrl, placeId, and address are required', 400);
  }
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return errorResponse('lat and lng are required', 400);
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

  try {
    await config.db
      .prepare(
        'INSERT INTO places (id, name, maps_url, place_id, address, lat, lng, note, tags, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)'
      )
      .bind(
        place.id,
        place.name,
        place.mapsUrl,
        place.placeId,
        place.address,
        place.lat,
        place.lng,
        place.note,
        place.tags,
        place.createdAt
      )
      .run();
  } catch (err) {
    console.error('[places] Failed to save place to D1.', err);
    return errorResponse('Failed to save place', 502);
  }

  return Response.json(place, { status: 201 });
}
