import { Datastore } from "@google-cloud/datastore";
import Config from "./config/index.js";

// When DATASTORE_EMULATOR_HOST is set (via `npm run dev`), the client
// automatically connects to the local emulator instead of Cloud Datastore.
export const datastore = new Datastore({
	projectId: process.env["GOOGLE_CLOUD_PROJECT"] ?? Config.getGcpProjectId(),
});
