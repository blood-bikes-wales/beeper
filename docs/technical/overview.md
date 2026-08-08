# Technical overview

## Purpose

Beeper is a Google Cloud Function that receives inbound SMS alerts from a bike tracking system (BikeTrac) via Twilio, looks up on-call volunteers from [Three Rings](https://www.3r.org.uk), and forwards the alert by SMS to the current **Duty Trustee** (and optionally the **Controller**).

## Stack

| Layer | Choice |
|-------|--------|
| Language / runtime | TypeScript on Node.js 24 |
| Framework / platform | `@google-cloud/functions-framework` → Cloud Functions Gen2 |
| Persistence | Cloud Datastore (Firestore in Datastore mode) via `@google-cloud/datastore` |
| Key integrations | Twilio (inbound webhook + outbound SMS), Three Rings HTTP API |
| Infra | Terraform (`infrastructure/`), GitHub Actions deploy |
| Lint / test | Biome, Jest + nock + supertest |

## Entrypoints

| Name | Location | Notes |
|------|----------|-------|
| `receiveMessage` | [`src/index.ts`](../../src/index.ts) | Sole HTTP Cloud Function; Terraform `entry_point` |
| Package main | `dist/index.js` | Built from TypeScript |
| Local server | `npm run dev` / `npm run run` | Functions Framework on `:8080` |
| Datastore emulator | `npm run emulator` | `localhost:8081`, project `beeper-local` |

There are no separate workers or CLIs.

## How to run

### Prerequisites

- Node.js 24+
- Google Cloud SDK with Datastore emulator component
- Java 21+ (emulator)
- Three Rings API access and Twilio credentials (see [`.env.example`](../../.env.example))

### Build

```bash
npm ci
npm run build          # tsc → dist/
npm run typecheck      # no emit
npm run package:deploy # dist/ + dist.zip for Terraform
```

### Test

```bash
npm run test:unit         # no emulator
# Terminal 1: npm run emulator
# Terminal 2:
npm run test:integration
npm test                  # all
```

### Local / deploy

```bash
npm run emulator   # terminal 1
npm run dev        # terminal 2 — function + emulator env
```

Production deploys on push to `main` (`plasma-production`). Staging deploys from PRs to `main` after CI (`plasma-staging-502110`). See root [`readme.md`](../../readme.md) for Terraform and GitHub Environment secrets.

## Key paths

| Path | Role |
|------|------|
| [`src/index.ts`](../../src/index.ts) | HTTP handler orchestration |
| [`src/twilio-webhook.ts`](../../src/twilio-webhook.ts) | Twilio signature validation |
| [`src/config/index.ts`](../../src/config/index.ts) | Env validation / feature flags |
| [`src/repository/`](../../src/repository/) | Three Rings HTTP + Datastore cache |
| [`src/service/`](../../src/service/) | Shift matching, message log, logging |
| [`infrastructure/`](../../infrastructure/) | GCP Terraform stack |
| [`tests/`](../../tests/) | Unit + integration tests |

## Environment variables

Names only — values live in `.env` / Secret Manager, never in docs. See [`.env.example`](../../.env.example).

| Variable | Role |
|----------|------|
| `THREE_RINGS_API_KEY` | Three Rings API auth |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio client |
| `TWILIO_WEBHOOK_URL` | Canonical URL for signature validation |
| `ENABLE_CONTROLLER_ALERTS` | Must be `"true"` to SMS Controllers |
| `GCP_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` | Live Datastore project |
| `DATASTORE_EMULATOR_HOST` / `DATASTORE_PROJECT_ID` | Local emulator (`npm run dev` sets these) |
| `DATASTORE_DATABASE_ID` | Named DB in GCP (`beeper-database`) |

## Pitfalls

- **`ENABLE_CONTROLLER_ALERTS`**: must be the string `"true"` to SMS Controllers. Terraform currently sets it to `false`, so deployed envs alert **Duty Trustee only** ([`infrastructure/main.tf`](../../infrastructure/main.tf), [`src/config/index.ts`](../../src/config/index.ts)).
- **`TWILIO_WEBHOOK_URL`** must match the URL Twilio posts to exactly (including trailing slash). See [local-twilio-webhook.md](local-twilio-webhook.md).
- Staging is a **shared** stack: concurrent PRs overwrite the last successful staging deploy; refresh the staging GitHub `TWILIO_WEBHOOK_URL` if the function URI changes.
- Deploy uses a **two-step** `terraform apply` (upload zip, then function) so source generation stays consistent.
- Three Rings cache in Datastore has **no TTL**; entries persist until overwritten.
- Shift matching requires exactly one matching Controller and Duty Trustee shift for “now”, or the handler errors.
