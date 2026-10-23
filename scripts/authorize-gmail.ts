import { execFile } from "node:child_process";
import http from "node:http";
import "dotenv/config";
import { gmail as gmailApi, auth as googleAuth } from "@googleapis/gmail";

const PORT = 53682;
const REDIRECT_PATH = "/oauth/callback";
const REDIRECT_URI = `http://127.0.0.1:${PORT}${REDIRECT_PATH}`;
const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";

type AuthCallback = { code: string } | { error: string };

async function main(): Promise<void> {
	if (process.argv.includes("--stop")) {
		await stopWatch();
		return;
	}

	await authorize();
}

async function authorize(): Promise<void> {
	const client = new googleAuth.OAuth2(
		requiredEnv("GMAIL_CLIENT_ID"),
		requiredEnv("GMAIL_CLIENT_SECRET"),
		REDIRECT_URI,
	);
	const url = client.generateAuthUrl({
		access_type: "offline",
		prompt: "consent",
		scope: [GMAIL_READONLY],
	});

	console.log("Opening a browser to sign in to the Gmail account to watch.");
	console.log(url);
	openBrowser(url);

	const code = await waitForAuthCode();
	const { tokens } = await client.getToken(code);
	if (!tokens.refresh_token) {
		throw new Error(
			"Google did not return a refresh token. Revoke this app's access and run the script again.",
		);
	}

	client.setCredentials(tokens);
	const gmail = gmailApi({ version: "v1", auth: client });
	const profile = await gmail.users.getProfile({ userId: "me" });

	console.log(`Signed in as ${profile.data.emailAddress}`);
	console.log("Set GMAIL_WATCH_USER to that address.");
	console.log("Refresh token (store in Secret Manager, do not commit):");
	console.log(tokens.refresh_token);
}

async function stopWatch(): Promise<void> {
	const auth = new googleAuth.OAuth2(
		requiredEnv("GMAIL_CLIENT_ID"),
		requiredEnv("GMAIL_CLIENT_SECRET"),
	);
	auth.setCredentials({ refresh_token: requiredEnv("GMAIL_REFRESH_TOKEN") });
	const gmail = gmailApi({ version: "v1", auth });
	await gmail.users.stop({ userId: "me" });
	const profile = await gmail.users.getProfile({ userId: "me" });
	console.log(`Stopped Gmail watch for ${profile.data.emailAddress}`);
}

function waitForAuthCode(): Promise<string> {
	return new Promise((resolve, reject) => {
		const server = http.createServer((req, res) => {
			handleAuthCallback(req, res, (result) => {
				server.close();
				if ("error" in result) {
					reject(new Error(`Google authorization failed: ${result.error}`));
					return;
				}

				resolve(result.code);
			});
		});

		server.on("error", reject);
		server.listen(PORT, "127.0.0.1");
	});
}

function handleAuthCallback(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	finish: (result: AuthCallback) => void,
): void {
	const requestUrl = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
	if (requestUrl.pathname !== REDIRECT_PATH) {
		res.writeHead(404);
		res.end("Not found");
		return;
	}

	const oauthError = requestUrl.searchParams.get("error");
	if (oauthError) {
		res.writeHead(400);
		res.end("Authorization failed. You can close this tab.");
		finish({ error: oauthError });
		return;
	}

	const code = requestUrl.searchParams.get("code");
	if (!code) {
		res.writeHead(400);
		res.end("Missing authorization code.");
		return;
	}

	res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
	res.end("Signed in. You can close this tab and return to the terminal.");
	finish({ code });
}

function openBrowser(url: string): void {
	const command = browserCommand();
	if (!command) {
		return;
	}

	execFile(command, [url], () => undefined);
}

function browserCommand(): string | undefined {
	if (process.platform === "darwin") {
		return "open";
	}

	if (process.platform === "linux") {
		return "xdg-open";
	}

	return undefined;
}

function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
}

main().catch((error: unknown) => {
	console.error(errorMessage(error));
	process.exitCode = 1;
});

function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
