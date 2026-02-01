# Project rules

- Everything runs via Docker Compose for local and production workflows.
- After every work cycle, ensure `README.md` is up to date and describes how the site is built, configured, and works.
- Never add fallbacks or silent defaults. There should be one correct code path.
- Require explicit configuration for secrets (e.g., `APP_PIN`).
- Keep the app simple: one shared list, one API, one storage path.
- At the end of each work cycle, clean up any failed or now-unused code; ask before removing documentation.
- After completing a change, bring the container up with Docker Compose and verify the app using the Chrome MCP server.
