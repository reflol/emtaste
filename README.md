# emtaste

A tabby cat, 80s-inspired web app for saving restaurants and places with Google Maps links. It runs on Cloudflare Pages (static) + Pages Functions (API) + D1 (storage). Local dev uses Docker Compose to run `wrangler pages dev`.

## Local development (Docker Compose)

```bash
cp .env.example .env
# edit .env and set APP_PIN + GOOGLE_MAPS_API_KEY
docker compose up -d
docker compose exec app npx wrangler d1 migrations apply emtaste --local
```

Open `http://localhost:3000`.

Local dev uses `wrangler pages dev` (serves static assets + Functions). Environment variables are read from `.env`.

## Configuration

- `APP_PIN` (required): Shared 6-digit PIN for all devices.
- `GOOGLE_MAPS_API_KEY` (required): Google Maps Places API (New) + Geocoding API key used for search and location display.
- `DB` (binding): D1 database binding configured in `wrangler.toml`.

## How it works

- Static UI lives in `public/`.
- Pages Functions live in `functions/api/*`.
- The browser requests geolocation on load; the saved list is sorted by distance from the user.
- Typing in the search box autocompletes nearby places via the Google Places Text Search API.
- Clicking a search result saves it and adds it to the list below.
- The UI shows your resolved location name from the Google Geocoding API.
- The Pin button triggers Add to Home Screen where supported (or shows minimal instructions on iOS).
- Every API request must include the shared PIN in the `x-pin` header.
- Data is stored in a single D1 database.
- Requests to `www.emtaste.com` are redirected to the apex domain by `functions/_middleware.js`.

## Production (Cloudflare Pages + D1)

Wrangler and API calls use a Cloudflare API token. Store it in `secrets/cf` and export it:

```bash
export CLOUDFLARE_API_TOKEN="$(cat secrets/cf)"
```

Use an **Account token** with:

- Account → Cloudflare Pages → Edit
- Account → D1 → Edit
- Zone → Read (required for DNS lookups)
- Zone → DNS → Edit (required if you want to manage DNS via API)

Account tokens do not have User permissions (like Memberships). Because Wrangler normally discovers accounts via the Memberships API, set `CLOUDFLARE_ACCOUNT_ID` in your shell before running Wrangler commands:

```bash
export CLOUDFLARE_ACCOUNT_ID=21e260d9fceed2c9e5539ef5853102ef
```

Deploy steps:

1) Create the D1 database and capture the database ID:

```bash
npx wrangler d1 create emtaste
```

Update `wrangler.toml` with the returned `database_id`.

2) Apply migrations:

```bash
npx wrangler d1 migrations apply emtaste --remote
```

3) Create the Pages project and deploy the `public/` output directory (Functions are included when using Wrangler):

```bash
npx wrangler pages project create
npx wrangler pages deploy public
```

4) Set `APP_PIN` and `GOOGLE_MAPS_API_KEY` as encrypted secrets in Pages > Settings > Variables and Secrets.

5) Add the custom domains `emtaste.com` and `www.emtaste.com` in Pages > Custom domains (or via the API).

If you want to do it via API:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"emtaste.com"}' \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/emtaste/domains"

curl -sS -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"www.emtaste.com"}' \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/emtaste/domains"
```

The app redirects `www` → apex in `functions/_middleware.js`.

## Notes

This version is intentionally simple: one shared list secured by a PIN. Anyone with the PIN can read and write to the list.
Saved entries require place ID and coordinates for distance sorting.
The UI is optimized for iPhone SE (2nd gen) as the primary device, with compact spacing and stacked controls at small widths.
If location is denied, enable it in your browser settings for emtaste.com.
