export type GmailPushNotification = {
	emailAddress: string;
	historyId: string;
};

type PubSubPushBody = {
	message?: {
		data?: string;
	};
};

export function decodeGmailPush(body: unknown): GmailPushNotification {
	const data = pubSubData(body);
	if (!data) {
		throw new Error("Invalid Pub/Sub push body");
	}

	const parsed = JSON.parse(
		Buffer.from(data, "base64url").toString("utf8"),
	) as Partial<GmailPushNotification>;
	if (
		!parsed.emailAddress ||
		parsed.historyId === undefined ||
		parsed.historyId === null
	) {
		throw new Error("Invalid Gmail push notification");
	}

	return {
		emailAddress: parsed.emailAddress,
		historyId: String(parsed.historyId),
	};
}

export function isNewerHistoryId(
	candidate: string,
	stored: string | undefined,
): boolean {
	if (!stored) {
		return true;
	}

	return BigInt(candidate) > BigInt(stored);
}

function pubSubData(body: unknown): string | undefined {
	if (!body || typeof body !== "object") {
		return undefined;
	}

	const data = (body as PubSubPushBody).message?.data;
	if (!data) {
		return undefined;
	}

	return data;
}
