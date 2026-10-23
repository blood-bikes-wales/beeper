import { auth, gmail, type gmail_v1 } from "@googleapis/gmail";
import Config from "../config";
import { axiosFetch } from "./http";

export function createGmailClient(): gmail_v1.Gmail {
	const client = new auth.OAuth2({
		clientId: Config.getGmailClientId(),
		clientSecret: Config.getGmailClientSecret(),
		transporterOptions: {
			fetchImplementation: axiosFetch,
		},
	});
	client.setCredentials({ refresh_token: Config.getGmailRefreshToken() });
	return gmail({ version: "v1", auth: client });
}
