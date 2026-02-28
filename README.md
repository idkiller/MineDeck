# MineDeck

MineDeck is a production-ready MVP admin panel for **one Minecraft Bedrock Dedicated Server** instance.

It is a **single SvelteKit app** (SSR + server actions + route handlers), with SQLite persistence, session auth, file-based Bedrock management, provider-based restarts, and optional RCON command support.

## Features Implemented

- Authentication
  - `/login` username/password
  - first-run admin seed from `ADMIN_USER` + `ADMIN_PASSWORD`
  - bcrypt password hashing
  - httpOnly session cookie (`SameSite=Lax`, `Secure` in production)
  - login rate limiting
  - CSRF protection for mutating actions
  - auth guard in `hooks.server.ts`
- Dashboard (`/`)
  - provider type, restart button
  - RCON connectivity status
  - active world (`server.properties` `level-name`)
  - disk usage for `/opt/mc-data`
  - recent log tail (200 lines)
  - command runner via RCON
- Server settings (`/server`)
  - structured editor for common `server.properties` keys
  - raw editor
  - comment/order-preserving line token model
  - atomic writes
  - one-click RCON enable
  - restart recommended flow + restart button
- Packs (`/packs`, `/packs/world/[world]`)
  - upload `.mcpack`, `.mcaddon`, `.zip` (100MB max)
  - safe extraction with zip-slip prevention
  - behavior/resource detection from `manifest.json`
  - install into `/opt/mc-data/behavior_packs` and `/opt/mc-data/resource_packs`
  - world-level pack enable/disable JSON editing
  - apply packs schedules restart (immediate or delayed 30s)
- Worlds (`/worlds`)
  - world listing + disk size
  - backup creation (`.tar.gz`) and metadata persistence
  - restore with required confirmation and pre-restore backup
  - delete with confirmation
  - set active world via `server.properties`
- Players (`/players`)
  - manage `allowlist.json`
  - manage `permissions.json`
  - atomic JSON writes
  - optional RCON say/list integration
- Monitoring (`/logs`)
  - tail logs with configurable line count + auto refresh
- Automation (`/automation`)
  - SQLite-backed jobs
  - `daily_backup`, `scheduled_restart`, `one_shot_restart`
  - scheduler load on app start (node-cron)
  - job run history table

## Tech Stack

- SvelteKit + TypeScript
- SSR + `+page.server.ts` form actions
- `@sveltejs/adapter-node`
- SQLite (`better-sqlite3`)
- `bcrypt`, `node-cron`, `adm-zip`, `tar`

## Project Structure

```text
/minedeck
  /src
    /lib/server
      auth.ts
      db.ts
      config.ts
      state.ts
      /providers
      /rcon
      /files
      /packs
      /worlds
      /players
      /automation
    /routes
      /login
      /
      /server
      /packs
      /packs/world/[world]
      /worlds
      /players
      /automation
      /logs
      /logout
    hooks.server.ts
  /config/panel.config.json
  svelte.config.js
  Dockerfile
  docker-compose.yml
```

## Configuration

Primary config file:

- `config/panel.config.json`

Supported values:

- `dataRoot` (default `/opt/mc-data`)
- `provider` (`docker` or `systemd`)
- `docker.containerName` (default `mc-bedrock`)
- `systemd.serviceName` (default `bedrock-server`)
- `rcon.host` (default `127.0.0.1`)
- `rcon.port` (optional; falls back to `server.properties`)
- `rcon.password` (optional; falls back to `server.properties`)

Environment overrides:

- `PANEL_CONFIG_PATH`
- `MINEDECK_DATA_ROOT`
- `MINEDECK_PROVIDER`
- `MINEDECK_DOCKER_CONTAINER`
- `MINEDECK_SYSTEMD_SERVICE`
- `MINEDECK_RCON_HOST`
- `MINEDECK_RCON_PORT`
- `MINEDECK_RCON_PASSWORD`

Required first run auth env vars:

- `ADMIN_USER`
- `ADMIN_PASSWORD`

If the users table is empty and these are missing, startup fails intentionally.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Set required env vars:

```bash
export ADMIN_USER=admin
export ADMIN_PASSWORD=change-me-now
```

3. Start dev server:

```bash
npm run dev
```

4. Open `http://localhost:5173`.

## Production (Node Adapter)

Build and run standalone server:

```bash
npm run build
node build
```

Default runtime port is `3000` (or `PORT` env).

## Docker Compose

Run with Docker (recommended when provider=`docker`):

```bash
docker compose up --build -d
```

This compose file mounts:

- `/opt/mc-data:/opt/mc-data`
- `/var/run/docker.sock:/var/run/docker.sock`

and uses `config/panel.config.json` as read-only config.

## Permissions Requirements

MineDeck must be able to:

- read/write under `/opt/mc-data`
- restart the Bedrock server via selected provider:
  - Docker: access to Docker socket/CLI
  - Systemd: permission to execute `systemctl` and `journalctl`

## Enabling RCON (Bedrock)

You can use MineDeck `/server` -> **Enable RCON (One Click)**, or set manually in `server.properties`:

- `enable-rcon=true`
- `rcon.port=<port>`
- `rcon.password=<strong-secret>`

Then restart the server.

## Cloudflare Tunnel Note

Cloudflare Tunnel is not implemented in-app. You can run tunneling separately in front of MineDeck (`http://<host>:3000`) and keep MineDeck private behind access controls.