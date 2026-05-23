import axios from "axios";

// Force axios to use the Node http adapter so nock can intercept requests.
// Without this, axios may use the fetch adapter (in Node 18+) which nock cannot intercept.
// https://github.com/nock/nock#axios
axios.defaults.adapter = "http";

process.env.THREE_RINGS_API_KEY = "test-api-key";
process.env.TWILIO_ACCOUNT_SID = "test-sid";
process.env.TWILIO_AUTH_TOKEN = "test-token";
