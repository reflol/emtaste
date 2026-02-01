# emtaste

A tabby cat, 80s-inspired web app for saving restaurants and places with Google Maps links. It runs on Bun, uses a shared PIN (no accounts), and stores data in a single Firestore collection.

## Docker Compose quick start

```bash
cp .env.example .env
# edit .env and set APP_PIN, GOOGLE_MAPS_API_KEY, PORT, and FIRESTORE_* values
# place your Firestore service account JSON at ./secrets/firestore-key.json
docker compose up -d --build
```

Open `http://localhost:3000`.

## Configuration

- `PORT` (required): Port the server listens on. Use `3000` for local Docker Compose.
- `APP_PIN` (required): Shared 6-digit PIN for all devices. The server exits if this is missing or not 6 digits.
- `GOOGLE_MAPS_API_KEY` (required): Google Maps Places API (New) + Geocoding API key used for search and location display. The server exits if this is missing.
- `FIRESTORE_PROJECT_ID` (required): GCP project that hosts the Firestore database.
- `FIRESTORE_DATABASE` (required): Firestore database ID. Use `(default)` unless you created a named database.
- `FIRESTORE_COLLECTION` (required): Collection name for the shared list.
- `GOOGLE_APPLICATION_CREDENTIALS` (required): Path to the service account JSON. In Docker Compose this is `/secrets/firestore-key.json` (mounted from `./secrets/firestore-key.json`).

The service account must have the `roles/datastore.user` role for the Firestore project.

## How it works

- Bun serves the static UI from `public/` and an API under `/api/*`.
- The browser requests geolocation on load; the saved list is sorted by distance from the user.
- Typing in the search box autocompletes nearby places via the Google Places Text Search API.
- Clicking a search result saves it and adds it to the list below.
- The UI shows your resolved location name from the Google Geocoding API.
- Every API request must include the shared PIN in the `x-pin` header.
- Data is stored in Firestore in a single collection.
- Non-API requests without a file extension return the SPA entrypoint (`index.html`).

## Deploy

Recommended: Cloud Run + Firestore (Native mode).

Deployment checklist:
- Build and deploy the container to Cloud Run (from source or a built image).
- Create a service account with `roles/datastore.user`.
- Store the service account JSON in Secret Manager and mount it as a file.
- Set `GOOGLE_APPLICATION_CREDENTIALS` to the mounted secret path.
- Set env vars: `PORT`, `APP_PIN`, `GOOGLE_MAPS_API_KEY`, `FIRESTORE_PROJECT_ID`, `FIRESTORE_DATABASE`, `FIRESTORE_COLLECTION`.
- Ensure the service is served over HTTPS (required for browser geolocation).

## Notes

This version is intentionally simple: one shared list secured by a PIN. Anyone with the PIN can read and write to the list.
Saved entries require place ID and coordinates for distance sorting. The legacy JSON file is no longer read; if you have old data, import it into Firestore before removing it.
The UI is optimized for iPhone SE (2nd gen) as the primary device, with compact spacing and stacked controls at small widths.
