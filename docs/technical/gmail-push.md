# Gmail push setup

Use this when you need Beeper to read a Workspace mailbox and receive Gmail push notifications. The Cloud Function has no login page. You sign in once on a laptop, store the refresh token, and the service uses that token after that.

## Before the first sign-in

In the same GCP project as Beeper (`plasma-staging-502110` or `plasma-production`):

1. Enable the Gmail API.
2. Open Google Auth Platform / OAuth consent screen and set the user type to **Internal**. An Internal screen limits consent to this Workspace, and the refresh token is not limited to 7 days. A screen left in **Testing** expires the token after 7 days and pushes stop.
3. Create an OAuth client of type **Desktop**. If Google asks for a redirect URI, use `http://127.0.0.1:53682/oauth/callback`.
4. Copy `.env.example` to `.env` and set `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.

Terraform creates the Pub/Sub topic `beeper-gmail`, grants `gmail-api-push@system.gserviceaccount.com` permission to publish, and pushes notifications to `receiveMessage` with an OIDC token. The function is not public. If the organisation blocks granting that Google service account, add a domain-restricted sharing exception for `gmail-api-push@system.gserviceaccount.com`.

## Sign in

The account you sign in as is the mailbox Beeper watches. While building, that is your own Workspace address. BikeTrac mail must arrive in that inbox.

```bash
npm run authorize-gmail
```

The script opens a browser, requests `https://www.googleapis.com/auth/gmail.readonly` with offline access, and prints the signed-in address and a refresh token. It does not write the token into the repo.

Then:

1. Set `GMAIL_REFRESH_TOKEN` to the printed token.
2. Set `GMAIL_WATCH_USER` to the printed address.
3. Set `GMAIL_ALERT_FROM` to the sender address whose plain-text body should be texted.
4. Put the same values in the GitHub environment (`staging` while building, `production` when that environment should watch this mailbox). `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN` are Secret Manager values. `GMAIL_CLIENT_ID`, `GMAIL_WATCH_USER`, and `GMAIL_ALERT_FROM` are plain environment variables.

Deploy, then run the `beeper-gmail-watch` function once (Cloud Scheduler also calls it daily at 06:00 Europe/London). That calls `users.watch` for `INBOX` and, if this mailbox has no stored history cursor, saves the `historyId` from the watch response. Later renewals do not move the cursor backwards.

Gmail’s push body is only `emailAddress` and `historyId`. `receiveMessage` loads mail added since the stored cursor. When the From address matches `GMAIL_ALERT_FROM`, it texts the event description from the plain-text body (the "A new Event has been created" section, without map links or the footer). If that section is missing, it texts the whole plain-text body with links removed and logs a warning.

## Stop a mailbox

Before you replace the refresh token, stop the current watch. Leftover watches keep publishing for up to 7 days.

```bash
npm run authorize-gmail -- --stop
```

That uses the `GMAIL_REFRESH_TOKEN` already in the environment and calls `users.stop`.

## Local push testing

1. Start the Datastore emulator (`npm run emulator`).
2. Start the function (`npm run dev`).
3. POST a Pub/Sub push body to `http://localhost:8080`. `message.data` is base64url JSON: `{"emailAddress":"<GMAIL_WATCH_USER>","historyId":"<newer than the stored cursor>"}`.
4. The function still calls Gmail and Three Rings, so local credentials must be able to read the mailbox, and a `GmailSync` cursor for `GMAIL_WATCH_USER` must already exist (run `npm run run:gmailWatch` once against the emulator, or write the cursor yourself).

Notifications for any other `emailAddress` are acknowledged and ignored.
