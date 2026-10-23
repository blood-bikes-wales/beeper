export type GmailHeader = {
	name?: string | null;
	value?: string | null;
};

export type GmailPart = {
	mimeType?: string | null;
	body?: { data?: string | null } | null;
	parts?: GmailPart[] | null;
	headers?: GmailHeader[] | null;
};

export function emailAddress(fromHeader: string): string {
	const wrapped = fromHeader.match(/<([^>]+)>/);
	const address = wrapped?.[1] ?? fromHeader;
	return address.trim().toLowerCase();
}

export function fromAddress(
	headers: GmailHeader[] | null | undefined,
): string | undefined {
	const from = headers?.find(
		(header) => header.name?.toLowerCase() === "from",
	)?.value;
	if (!from) {
		return undefined;
	}

	return emailAddress(from);
}

export function senderMatches(actual: string, expected: string): boolean {
	return actual.toLowerCase() === expected.trim().toLowerCase();
}

export function plainTextFromPayload(
	payload: GmailPart | null | undefined,
): string | undefined {
	return plainTextFromPart(payload ?? undefined);
}

function plainTextFromPart(part: GmailPart | undefined): string | undefined {
	if (!part) {
		return undefined;
	}

	const direct = plainTextData(part);
	if (!direct) {
		return firstPlainText(part.parts ?? []);
	}

	return direct;
}

function plainTextData(part: GmailPart): string | undefined {
	if (part.mimeType !== "text/plain" || !part.body?.data) {
		return undefined;
	}

	const text = decodeGmailBody(part.body.data);
	if (text.length === 0) {
		return undefined;
	}

	return text;
}

function firstPlainText(parts: GmailPart[]): string | undefined {
	return parts
		.map((part) => plainTextFromPart(part))
		.find((text) => text !== undefined);
}

function decodeGmailBody(data: string): string {
	const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
	return Buffer.from(normalized, "base64").toString("utf8").trim();
}
