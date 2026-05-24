<img width="1536" height="1024" alt="Repository Logo" src="https://github.com/user-attachments/assets/8b23173b-3e8e-41a7-a46d-006bc1477c7f" />

# beeper

A Google Cloud Function that receives inbound SMS alerts from a bike tracking system (BikeTrac) via Twilio, looks up the on-call volunteers from [Three Rings](https://www.3r.org.uk), and forwards the alert to the current Controller and Duty Trustee by SMS.

## How it works

1. BikeTrac sends a Twilio SMS alert to a configured phone number when a tracked bike triggers an event (e.g. theft detection).
2. Twilio forwards the inbound message as an HTTP POST to the `receiveMessage` Cloud Function.
3. The function queries the Three Rings rota to find who is on shift right now as **Controller** and **Duty Trustee**.
4. It fetches each volunteer's phone number from the Three Rings directory.
5. It forwards the original alert body to both volunteers via Twilio SMS.

## Prerequisites

- Node.js 18+
- A [Three Rings](https://www.3r.org.uk) account with API access
- A [Twilio](https://www.twilio.com) account

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```
THREE_RINGS_API_KEY=   # Three Rings API key
TWILIO_ACCOUNT_SID=    # Twilio account SID (starts with AC...)
TWILIO_AUTH_TOKEN=     # Twilio auth token
```

## Running locally

```bash
npm install
npm run run
```

This compiles the TypeScript and starts the Google Cloud Functions Framework on `http://localhost:8080`, targeting the `receiveMessage` function.

## Running tests

```bash
npm test                  # all tests
npm run test:integration  # integration tests only
```

Tests use [nock](https://github.com/nock/nock) to intercept Three Rings HTTP requests and [Jest](https://jestjs.io) for assertions. No real network calls are made.

## Building

```bash
npm run build   # compiles TypeScript to dist/
npm run watch   # watch mode
```

## Project structure

```
src/
  index.ts                          # Cloud Function entry point
  config/
    index.ts                        # Reads and validates environment variables
  repository/
    IThreeRingsRepository.ts        # Repository interface
    ThreeRingsHttpRepository.ts     # Fetches rota and volunteer data from Three Rings API
  service/
    three-rings.ts                  # Business logic: shift matching, property lookup
  types/
    DirectoryResponse.type.ts       # Three Rings directory API response shape
    RotaResponse.type.ts            # Three Rings rota API response shape
    RequestBody.type.ts             # Inbound Twilio webhook body shape
    RotaType.enum.ts                # "Controller" | "Duty Trustee"
    VolunteerPropertyType.enum.ts   # Volunteer property types (e.g. TelProperty)
  utility.ts                        # getCurrentDate helper (mockable in tests)

tests/
  setup.ts                          # Global Jest setup (env vars, axios adapter)
  fixtures/                         # Recorded API responses used in integration tests
  integration/
    receiveMessage.test.ts          # End-to-end integration test for the Cloud Function
```

## Linting

The project uses [Biome](https://biomejs.dev) for linting and formatting:

```bash
npm run lint        # check
npm run lint:fix    # auto-fix
```
