# Runbook: Local Twilio webhook testing

## When to use

You need to receive real Twilio inbound SMS against a local Beeper process (tunnel + emulator), or you are debugging signature validation failures.

## Preconditions

- Node 24+, `gcloud` Datastore emulator, Java 21+
- `.env` filled from [`.env.example`](../../.env.example) (Three Rings + Twilio credentials)
- A tunnel tool (e.g. ngrok) that can expose `localhost:8080`

## Steps

1. Start the Datastore emulator: `npm run emulator` (leave running on `localhost:8081`).
2. Start the function: `npm run dev` (Functions Framework on `http://localhost:8080`, target `receiveMessage`).
3. Expose port 8080 with a public HTTPS tunnel.
4. Set `TWILIO_WEBHOOK_URL` in `.env` to the **exact** public URL Twilio will POST to (including path and trailing slash if Twilio includes one).
5. Restart `npm run dev` so the new env value is loaded.
6. In Twilio, point the phone number (or Messaging Service) inbound webhook at that same URL.
7. Send a test SMS to the Twilio number (or use Twilio’s debugger to replay a webhook).

## Verification

- Function returns **204** on success.
- Emulator / logs show an `IncomingRequest` and at least one `OutgoingMessage` when on-call lookup succeeds.
- Invalid or mismatched `TWILIO_WEBHOOK_URL` → signature validation fails (no forward).

## Rollback / recovery

- Point Twilio’s webhook back to staging or production URI when finished.
- Stop the tunnel so the temporary URL is no longer reachable.

## Related

- [Technical overview](overview.md)
- [Architecture](architecture.md) — signature validation and happy path
- Staging webhook URI notes: [staging-first-apply-blocker.md](staging-first-apply-blocker.md)
- Root README “Running locally with Twilio”: [../../readme.md](../../readme.md)
