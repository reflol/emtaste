# Project rules

- Everything runs via Docker Compose for local development workflows.
- Production deploys to Cloudflare Pages + Pages Functions + D1.
- After every work cycle, ensure `README.md` is up to date and describes how the site is built, configured, and works.
- Never add fallbacks or silent defaults. There should be one correct code path.
- Require explicit configuration for secrets (e.g., `APP_PIN`).
- Keep the app simple: one shared list, one API, one storage path.
- At the end of each work cycle, clean up any failed or now-unused code; ask before removing documentation.
- After completing a change, deploy to production and verify the live site with the Chrome MCP server.
- The PIN and Location modals must be minimal: only the title ("PIN" or "Location") plus the required controls. No descriptive subtext.
