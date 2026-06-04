import "dotenv/config";

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

// biome-ignore lint/complexity/noStaticOnlyClass: <we dont need an instance for "config">
export default class Config {
	static getTwilioAccountSid(): string {
		return required("TWILIO_ACCOUNT_SID");
	}

	static getTwilioAuthToken(): string {
		return required("TWILIO_AUTH_TOKEN");
	}

	static getThreeRingsApiKey(): string {
		return required("THREE_RINGS_API_KEY");
	}

	static getGcpProjectId(): string {
		return required("GCP_PROJECT_ID");
	}

	static resolveGcpProjectId(): string {
		const projectId =
			process.env["GOOGLE_CLOUD_PROJECT"] ??
			process.env["DATASTORE_PROJECT_ID"] ??
			process.env["GCP_PROJECT_ID"];

		if (!projectId) {
			throw new Error(
				"No GCP project ID found. Set GOOGLE_CLOUD_PROJECT, DATASTORE_PROJECT_ID, or GCP_PROJECT_ID.",
			);
		}

		return projectId;
	}
}
