import { Datastore } from "@google-cloud/datastore";
import Config from "./config";

// When DATASTORE_EMULATOR_HOST is set (via `npm run dev`), the client
// automatically connects to the local emulator instead of Cloud Datastore.
export const datastore = new Datastore(datastoreConfig());

function datastoreConfig(): ConstructorParameters<typeof Datastore>[0] {
	const projectId = Config.resolveGcpProjectId();
	const databaseId = Config.resolveDatastoreDatabaseId();
	if (!databaseId) {
		return { projectId };
	}

	return { projectId, databaseId };
}
