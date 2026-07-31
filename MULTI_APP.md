# Multi-app layout (lmsBox + GLC)

This solution supports multiple branded deployments that share one core codebase.

## Projects

| Project | Role |
|---------|------|
| `lmsbox.domain` | Shared entities and DTOs |
| `lmsbox.infrastructure` | EF Core `ApplicationDbContext` and migrations |
| `lmsbox.host` | Shared API controllers, services, email templates |
| `lmsBox.Server` | lmsBox deployable host (config + `wwwroot`) |
| `glc.Server` | GLC deployable host (config + `wwwroot`) |
| `lmsbox.client` | lmsBox React UI |
| `glc.client` | GLC React shell (reuses `lmsbox.client/src` via Vite alias) |

## Local development

**lmsBox**

```bash
# API (port 5132)
dotnet run --project lmsBox.Server

# UI (port 5173/5175 per your setup)
cd lmsbox.client && npm run dev
```

**GLC**

```bash
# API (port 5133) — creates/updates Database=glc on first run
dotnet run --project glc.Server

# UI (port 5176)
cd glc.client && npm install && npm run dev
```

Copy or align env vars from `lmsbox.client/.env` into `glc.client/.env.development` (at minimum `VITE_RECAPTCHA_SITE_KEY` for login).

Configure secrets in `glc.Server/appsettings.Development.json` (storage, SendGrid, OAuth, etc.).

## Deploying

1. Build/publish the correct host: `lmsBox.Server` or `glc.Server`.
2. Build the matching client into that host’s `wwwroot` (`npm run build` in `lmsbox.client` or `glc.client`).
3. Run EF migrations against that app’s database (same migration assembly: `lmsbox.infrastructure`).

## Customisation

- **Shared behaviour**: edit `lmsbox.host` (or domain/infrastructure).
- **Brand-only API/config**: `appsettings*.json` per `*.Server` project.
- **Brand-only UI**: add pages under `glc.client/src` later, or extend `lmsbox.client/src/theme/tenants.json` and set `VITE_APP_TENANT=glc` in `glc.client/.env`.

## Promoting GLC features to core

Move implementation from `glc.client` / future `glc.*` extensions into `lmsbox.host` and `lmsbox.client`, then register for all hosts.
