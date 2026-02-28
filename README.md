# MineDeck

MineDeck is a production-ready MVP admin panel for **one Minecraft Bedrock Dedicated Server** instance.

It is a **single SvelteKit app** (SSR + server actions + route handlers), with SQLite persistence, session auth, file-based Bedrock management, provider-based restarts, and provider-based command dispatch.

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
  - provider command channel status
  - active world (`server.properties` `level-name`)
  - disk usage for `/opt/mc-data`
  - recent log tail (200 lines)
  - command runner via provider
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
  - optional provider-based `say`/`list` command integration
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
- `systemd.commandExec` (optional helper path, default sample: `/usr/local/bin/bedrock-send-command`)
- `rcon.host` / `rcon.port` / `rcon.password` (legacy; current command channel does not require these)

Environment overrides:

- `PANEL_CONFIG_PATH`
- `MINEDECK_DATA_ROOT`
- `MINEDECK_PROVIDER`
- `MINEDECK_DOCKER_CONTAINER`
- `MINEDECK_SYSTEMD_SERVICE`
- `MINEDECK_SYSTEMD_COMMAND_EXEC`
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
  - Systemd: permission to execute `systemctl` and `journalctl`, plus either:
    - writable service stdin (`/proc/<MainPID>/fd/0`), or
    - a helper executable (`systemd.commandExec`) that accepts one command argument and forwards it to the server console

## Provider Command Notes

- Docker provider uses `docker exec <container> send-command "<cmd>"` (itzg image helper).
- Some Bedrock setups write command output to logs instead of stdout. MineDeck will show best-effort output and may direct you to `/logs`.
- Systemd provider defaults to stdin injection on `MainPID`. For more reliable behavior, configure `systemd.commandExec` (or `MINEDECK_SYSTEMD_COMMAND_EXEC`) with your own command forwarder script.

## Cloudflare Tunnel Note

Cloudflare Tunnel is not implemented in-app. You can run tunneling separately in front of MineDeck (`http://<host>:3000`) and keep MineDeck private behind access controls.
