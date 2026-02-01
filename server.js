import crypto from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const appPin = (process.env.APP_PIN || '').trim();
if (!appPin) {
  console.error('[places] APP_PIN is required. Set it in the environment.');
  process.exit(1);
}
const pinHash = crypto.createHash('sha256').update(appPin).digest();

const dataDir = join(import.meta.dir, 'data');
const dataFile = join(dataDir, 'places.json');
mkdirSync(dataDir, { recursive: true });

const publicDir = join(import.meta.dir, 'public');
const indexFile = Bun.file(join(publicDir, 'index.html'));

let store = { places: [] };

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

  store = parsed;
}

function saveStore() {
  const tempFile = `${dataFile}.tmp`;
  writeFileSync(tempFile, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tempFile, dataFile);
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

  const requested = pathname.replace(/^\\/+/, '');
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

      if (pathname === '/api/places' && request.method === 'GET') {
        const sorted = [...store.places].sort((a, b) => b.createdAt - a.createdAt);
        return Response.json(sorted);
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
        const note = body?.note ? String(body.note).trim() : '';
        const tags = body?.tags ? String(body.tags).trim() : '';

        if (!name || !mapsUrl) {
          return Response.json({ error: 'name and mapsUrl are required' }, { status: 400 });
        }

        const place = {
          id: crypto.randomUUID(),
          name,
          mapsUrl,
          note,
          tags,
          createdAt: Date.now()
        };
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
