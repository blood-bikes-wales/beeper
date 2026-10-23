import axios from "axios";

// Force axios to use the Node http adapter so nock can intercept requests.
// Without this, axios may use the fetch adapter (in Node 18+) which nock cannot intercept.
// https://github.com/nock/nock#axios
axios.defaults.adapter = "http";

process.env.THREE_RINGS_API_KEY = "test-api-key";
process.env.TWILIO_ACCOUNT_SID = "test-sid";
process.env.TWILIO_AUTH_TOKEN = "test-token";
process.env.GMAIL_CLIENT_ID = "test-client-id";
process.env.GMAIL_CLIENT_SECRET = "test-client-secret";
process.env.GMAIL_REFRESH_TOKEN = "test-refresh-token";
process.env.GMAIL_WATCH_USER = "alerts@example.com";
process.env.GMAIL_ALERT_FROM = "biketrac@example.com";
process.env.GMAIL_PUBSUB_TOPIC = "projects/beeper-local/topics/beeper-gmail";

// Connect to the local Datastore emulator (started via `npm run emulator`).
process.env.DATASTORE_EMULATOR_HOST = "localhost:8081";
process.env.GCP_PROJECT_ID = "beeper-local";
