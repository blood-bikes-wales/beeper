import { timingSafeEqual } from "node:crypto";
import querystring from "node:querystring";
import type { Request } from "@google-cloud/functions-framework";
import twilio from "twilio";
import Config from "./config";

type RequestWithRawBody = Request & { rawBody?: Buffer };

function trailingSlashVariants(url: string): string[] {
	const variants = new Set([url]);
	if (url.endsWith("/")) {
		variants.add(url.slice(0, -1));
	} else {
		variants.add(`${url}/`);
	}
	return [...variants];
}

function getWebhookUrlCandidates(req: Request): string[] {
	const configured = Config.getTwilioWebhookUrl();
	if (configured) {
		return trailingSlashVariants(configured);
	}

	const protocol = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
	const host = req.get("x-forwarded-host") ?? req.get("host");
	if (!host) {
		throw new Error("Missing Host header for Twilio webhook validation");
	}

	const path = req.originalUrl ?? req.url ?? "/";
	return trailingSlashVariants(`${protocol}://${host}${path}`);
}

function getWebhookParams(
	req: RequestWithRawBody,
): Record<string, string | string[]> {
	const contentType = req.get("content-type") ?? "";

	// Parse the raw body so params match exactly what Twilio signed.
	// body-parser's extended mode can transform values differently.
	if (
		contentType.includes("application/x-www-form-urlencoded") &&
		req.rawBody
	) {
		return querystring.parse(req.rawBody.toString()) as Record<
			string,
			string | string[]
		>;
	}

	return (req.body ?? {}) as Record<string, string | string[]>;
}

function signaturesMatch(received: string, expected: string): boolean {
	try {
		return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
	} catch {
		return false;
	}
}

export function isValidTwilioWebhook(req: Request): boolean {
	const signature = req.get("x-twilio-signature");
	if (!signature) {
		return false;
	}

	const authToken = Config.getTwilioAuthToken();
	const params = getWebhookParams(req as RequestWithRawBody);

	for (const url of getWebhookUrlCandidates(req)) {
		if (twilio.validateRequest(authToken, signature, url, params)) {
			return true;
		}

		// validateRequest normalises URLs in ways that break no-trailing-slash
		// webhook URLs (common in Twilio console). Compare directly as fallback.
		const expected = twilio.getExpectedTwilioSignature(authToken, url, params);
		if (signaturesMatch(signature, expected)) {
			return true;
		}
	}

	return false;
}
