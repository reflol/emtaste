# emtaste

A tabby cat, 80s-inspired web app for saving restaurants and places with Google Maps links. It runs on Bun, uses a shared PIN (no accounts), and stores data in a single JSON file on disk.

## Docker Compose quick start

```bash
cp .env.example .env
# edit .env and set APP_PIN plus GOOGLE_MAPS_API_KEY
docker compose up -d --build
```

Open `http://localhost:3000`.

## Configuration

- `APP_PIN` (required): Shared 6-digit PIN for all devices. The server exits if this is missing or not 6 digits.
- `GOOGLE_MAPS_API_KEY` (required): Google Maps Places API (New) + Geocoding API key used for search and location display. The server exits if this is missing.

## How it works

- Bun serves the static UI from `public/` and an API under `/api/*`.
- The browser requests geolocation on load; the saved list is sorted by distance from the user.
- Typing in the search box autocompletes nearby places via the Google Places Text Search API.
- Clicking a search result saves it and adds it to the list below.
- The UI shows your resolved location name from the Google Geocoding API.
- Every API request must include the shared PIN in the `x-pin` header.
- Data is stored in `/app/data/places.json` and persisted via the Docker volume.
- Non-API requests without a file extension return the SPA entrypoint (`index.html`).

## Deploy

This app is designed to run via Docker Compose on a host with a persistent volume.
Data lives in `/app/data/places.json` inside the container and is persisted via the `places_data` volume.

Deployment checklist:
- Set `APP_PIN` in your `.env`.
- Attach your custom domain via your reverse proxy (Caddy, Traefik, Nginx, etc.).
- Ensure the app is served over HTTPS.

## Notes

This version is intentionally simple: one shared list secured by a PIN. Anyone with the PIN can read and write to the list.
Saved entries require place ID and coordinates for distance sorting. If you upgraded from an older version without those fields, delete `/app/data/places.json` (or the `places_data` volume) and re-save your places.
The UI is optimized for iPhone SE (2nd gen) as the primary device, with compact spacing and stacked controls at small widths.
