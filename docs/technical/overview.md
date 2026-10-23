# Technical overview

## Purpose

Beeper is a Google Cloud Function that receives BikeTrac alert emails through Gmail push notifications, looks up on-call volunteers from [Three Rings](https://www.3r.org.uk), and forwards the alert by SMS to the current **Duty Trustee** (and optionally the **Controller**).

## Stack

| Layer | Choice |
|-------|--------|
| Language / runtime | TypeScript on Node.js 24 |
| Framework / platform | `@google-cloud/functions-framework` → Cloud Functions Gen2 |
| Persistence | Cloud Datastore (Firestore in Datastore mode) via `@google-cloud/datastore` |
| Key integrations | Gmail API push (inbound email), Twilio (outbound SMS), Three Rings HTTP API |
| Infra | Terraform (`infrastructure/`), GitHub Actions deploy |
| Lint / test | Biome, Jest + nock + supertest |

## Entrypoints

| Name | Location | Notes |
|------|----------|-------|
| `receiveMessage` | [`src/functions/receiveMessage.ts`](../../src/functions/receiveMessage.ts) | Gmail Pub/Sub push; Terraform `entry_point` on `beeper` |
| `renewGmailWatch` | [`src/functions/renewGmailWatch.ts`](../../src/functions/renewGmailWatch.ts) | Daily Gmail `users.watch`; Terraform `entry_point` on `beeper-gmail-watch` |
| `threeRingsHotCache` | [`src/functions/threeRingsHotCache.ts`](../../src/functions/threeRingsHotCache.ts) | Hourly scheduler cache warm; Terraform `entry_point` on `beeper-three-rings-hot-cache` |
| Deploy barrel | [`src/index.ts`](../../src/index.ts) | Registers all handlers for the shared deploy zip |
| Sign-in script | [`scripts/authorize-gmail.ts`](../../scripts/authorize-gmail.ts) | `npm run authorize-gmail` |
| Package main | `dist/index.js` | Built from TypeScript |
| Local server | `npm run dev` / `npm run run` | Functions Framework on `:8080`, target `receiveMessage` |
| Hot cache (local) | `npm run run:hotCache` | Functions Framework on `:8080`, target `threeRingsHotCache` |
| Gmail watch (local) | `npm run run:gmailWatch` | Functions Framework on `:8080`, target `renewGmailWatch` |
| Mailbox sign-in | `npm run authorize-gmail` | Prints a refresh token; `--stop` calls `users.stop` |
| Datastore emulator | `npm run emulator` | `localhost:8081`, project `beeper-local` |

The only local CLI is `npm run authorize-gmail`, which signs into the mailbox to watch. It is not deployed.

## How to run

### Prerequisites

- Node.js 24+
- Google Cloud SDK with Datastore emulator component
- Java 21+ (emulator)
- Three Rings API access, Twilio credentials for outbound SMS, and a Gmail OAuth client (see [`.env.example`](../../.env.example) and [gmail-push.md](gmail-push.md))

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
npm run dev        # terminal 2 — receiveMessage + emulator env
npm run run:hotCache    # optional — threeRingsHotCache only
npm run run:gmailWatch  # optional — renewGmailWatch only
npm run authorize-gmail # one-time mailbox sign-in
```

Production deploys on push to `main` (`plasma-production`). Staging deploys from PRs to `main` after CI (`plasma-staging-502110`). See root [`readme.md`](../../readme.md) for Terraform and GitHub Environment secrets.

## Key paths

| Path | Role |
|------|------|
| [`src/index.ts`](../../src/index.ts) | Deploy barrel (registers all handlers for the shared zip) |
| [`src/functions/`](../../src/functions/) | HTTP handler implementations |
| [`src/gmail/`](../../src/gmail/) | Gmail OAuth client, history, and plain-text parsing |
| [`scripts/authorize-gmail.ts`](../../scripts/authorize-gmail.ts) | One-time Workspace sign-in |
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
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Outbound Twilio SMS |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` | Gmail OAuth for the watched mailbox |
| `GMAIL_WATCH_USER` | Workspace address that owns the refresh token |
| `GMAIL_ALERT_FROM` | Sender address whose plain-text body is texted |
| `GMAIL_PUBSUB_TOPIC` | Full Pub/Sub topic name Gmail publishes to |
| `ENABLE_CONTROLLER_ALERTS` | Must be `"true"` to SMS Controllers |
| `GCP_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` | Live Datastore project |
| `DATASTORE_EMULATOR_HOST` / `DATASTORE_PROJECT_ID` | Local emulator (`npm run dev` sets these) |
| `DATASTORE_DATABASE_ID` | Named DB in GCP (`beeper-database`) |

## Pitfalls

- **`ENABLE_CONTROLLER_ALERTS`**: must be the string `"true"` to SMS Controllers. Terraform currently sets it to `false`, so deployed envs alert **Duty Trustee only** ([`infrastructure/main.tf`](../../infrastructure/main.tf), [`src/config/index.ts`](../../src/config/index.ts)).
- The OAuth consent screen must be **Internal**. A screen left in Testing expires the refresh token after 7 days. See [gmail-push.md](gmail-push.md).
- `users.watch` expires after 7 days. The daily `beeper-gmail-watch` scheduler renews it.
- Staging is a **shared** stack: concurrent PRs overwrite the last successful staging deploy.
- Deploy uses a **two-step** `terraform apply` (upload zip, then function) so source generation stays consistent.
- Three Rings cache in Datastore (rota and volunteer directory) has a **24-hour TTL** (`expiresAt`).
- Incoming and outgoing message logs in Datastore have a **28-day TTL**.
- Cloud Function application logs in Cloud Logging (`_Default` bucket) are retained for **28 days**.
- Shift matching requires exactly one matching Controller and Duty Trustee shift for “now”, or the handler errors.
