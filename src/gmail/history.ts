import type { gmail_v1 } from "@googleapis/gmail";
import { extractAlertText } from "./alert-text";
import {
	fromAddress,
	plainTextFromPayload,
	senderMatches,
} from "./parse-message";

export type AlertMessage = {
	id: string;
	from: string;
	body: string;
	matched: boolean;
};

export async function listMessageIdsToRead(
	gmail: gmail_v1.Gmail,
	startHistoryId: string,
	alertFrom: string,
): Promise<string[]> {
	try {
		return await listAddedMessageIds(gmail, startHistoryId);
	} catch (error) {
		if (!isNotFound(error)) {
			throw error;
		}

		return listRecentMessageIds(gmail, alertFrom);
	}
}

export async function readMatchingAlert(
	gmail: gmail_v1.Gmail,
	id: string,
	alertFrom: string,
): Promise<AlertMessage | undefined> {
	const message = await getMessage(gmail, id);
	if (!message) {
		return undefined;
	}

	const payload = message.payload;
	const from = fromAddress(payload?.headers);
	const body = plainTextFromPayload(payload);
	if (!from || !body) {
		return undefined;
	}

	if (!senderMatches(from, alertFrom)) {
		return undefined;
	}

	const extracted = extractAlertText(body);
	if (!extracted.body) {
		return undefined;
	}

	return { id, from, body: extracted.body, matched: extracted.matched };
}

// History still lists messages deleted since the cursor, such as replaced
// drafts. Failing on them would block the cursor and every later alert.
async function getMessage(
	gmail: gmail_v1.Gmail,
	id: string,
): Promise<gmail_v1.Schema$Message | undefined> {
	try {
		const response = await gmail.users.messages.get({
			userId: "me",
			id,
			format: "full",
		});
		return response.data;
	} catch (error) {
		if (!isNotFound(error)) {
			throw error;
		}

		return undefined;
	}
}

async function listAddedMessageIds(
	gmail: gmail_v1.Gmail,
	startHistoryId: string,
): Promise<string[]> {
	const ids: string[] = [];
	let pageToken: string | undefined;

	do {
		const response = await listHistoryPage(gmail, startHistoryId, pageToken);
		ids.push(...messageIdsFromHistory(response.data.history ?? []));
		pageToken = response.data.nextPageToken ?? undefined;
	} while (pageToken);

	return ids;
}

async function listHistoryPage(
	gmail: gmail_v1.Gmail,
	startHistoryId: string,
	pageToken: string | undefined,
) {
	const params: gmail_v1.Params$Resource$Users$History$List = {
		userId: "me",
		startHistoryId,
		historyTypes: ["messageAdded"],
		labelId: "INBOX",
	};
	if (pageToken) {
		params.pageToken = pageToken;
	}

	return gmail.users.history.list(params);
}

async function listRecentMessageIds(
	gmail: gmail_v1.Gmail,
	alertFrom: string,
): Promise<string[]> {
	const response = await gmail.users.messages.list({
		userId: "me",
		q: `from:${alertFrom} newer_than:1d`,
		labelIds: ["INBOX"],
		maxResults: 5,
	});

	return (response.data.messages ?? []).flatMap((message) =>
		presentId(message.id),
	);
}

function messageIdsFromHistory(history: gmail_v1.Schema$History[]): string[] {
	return history.flatMap((entry) => addedMessageIds(entry.messagesAdded));
}

function addedMessageIds(
	added: gmail_v1.Schema$History["messagesAdded"],
): string[] {
	return (added ?? []).flatMap((item) => presentId(item.message?.id));
}

function presentId(id: string | null | undefined): string[] {
	if (!id) {
		return [];
	}

	return [id];
}

function isNotFound(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	if ("code" in error && error.code === 404) {
		return true;
	}

	return "status" in error && error.status === 404;
}
