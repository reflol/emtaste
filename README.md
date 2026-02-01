# emtaste

A cat-themed web app for saving restaurants and places with Google Maps links. It runs on Bun, uses a shared PIN (no accounts), and stores data in a single JSON file on disk.

## Docker Compose quick start

```bash
cp .env.example .env
# edit .env and set APP_PIN to your shared PIN
docker compose up -d --build
```

Open `http://localhost:3000`.

## Configuration

- `APP_PIN` (required): Shared PIN for all devices. The server exits if this is missing.

## How it works

- Bun serves the static UI from `public/` and an API under `/api/*`.
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
