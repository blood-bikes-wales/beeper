import Config from "../config";
import { createGmailClient } from "../gmail/client";
import { listMessageIdsToRead, readMatchingAlert } from "../gmail/history";
import { type GmailPushNotification, isNewerHistoryId } from "../gmail/push";
import { GmailSyncStore } from "../gmail/sync-store";
import { forwardAlert } from "./forward-alert.service";
import type { Logger } from "./logging.service";

export async function handleGmailPush(
	notification: GmailPushNotification,
	log: Logger,
): Promise<void> {
	const watchUser = Config.getGmailWatchUser();
	if (notification.emailAddress.toLowerCase() !== watchUser.toLowerCase()) {
		log.info(
			{ emailAddress: notification.emailAddress },
			"Ignoring notification for another mailbox",
		);
		return;
	}

	const sync = new GmailSyncStore();
	const stored = await sync.getHistoryId(watchUser);
	if (!isNewerHistoryId(notification.historyId, stored)) {
		log.info(
			{ historyId: notification.historyId },
			"Notification history is not newer",
		);
		return;
	}

	if (!stored) {
		await sync.saveHistoryId(watchUser, notification.historyId);
		log.info(
			{ historyId: notification.historyId },
			"Stored initial Gmail history cursor",
		);
		return;
	}

	const gmail = createGmailClient();
	const ids = await listMessageIdsToRead(
		gmail,
		stored,
		Config.getGmailAlertFrom(),
	);
	for (const id of ids) {
		await forwardMatchingMessage(gmail, id, log);
	}

	await sync.saveHistoryId(watchUser, notification.historyId);
	log.info(
		{ historyId: notification.historyId, messages: ids.length },
		"Advanced Gmail history cursor",
	);
}

async function forwardMatchingMessage(
	gmail: ReturnType<typeof createGmailClient>,
	id: string,
	log: Logger,
): Promise<void> {
	const alert = await readMatchingAlert(gmail, id, Config.getGmailAlertFrom());
	if (!alert) {
		log.info({ messageId: id }, "Skipping message that is not an alert");
		return;
	}

	if (!alert.matched) {
		log.warn(
			{ messageId: alert.id },
			"BikeTrac email did not match the expected template; forwarding full text",
		);
	}

	log.info({ messageId: alert.id, from: alert.from }, "Forwarding alert email");
	await forwardAlert({ id: alert.id, body: alert.body, from: alert.from }, log);
}
