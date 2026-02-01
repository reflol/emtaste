const pinPattern = /^\d{6}$/;

export function requireEnv(env, name) {
  const raw = env?.[name];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function getConfig(env) {
  const appPin = requireEnv(env, 'APP_PIN');
  if (!pinPattern.test(appPin)) {
    throw new Error('APP_PIN must be exactly 6 digits.');
  }
  const mapsKey = requireEnv(env, 'GOOGLE_MAPS_API_KEY');
  const db = env?.DB;
  if (!db) {
    throw new Error('DB binding is required.');
  }
  return { appPin, mapsKey, db };
}

export function verifyPin(request, appPin) {
  const pin = (request.headers.get('x-pin') || '').trim();
  if (!pin) {
    return { ok: false, response: errorResponse('PIN required', 401) };
  }
  if (pin !== appPin) {
    return { ok: false, response: errorResponse('Invalid PIN', 403) };
  }
  return { ok: true };
}

export function errorResponse(message, status = 400) {
  return Response.json({ error: message }, { status });
}
