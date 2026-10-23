import type { Request, Response } from "@google-cloud/functions-framework";
import * as functions from "@google-cloud/functions-framework";
import Config from "../config";
import { createGmailClient } from "../gmail/client";
import { GmailSyncStore } from "../gmail/sync-store";
import { createRequestLogger } from "../service/logging.service";
import Utility from "../utility";

export const renewGmailWatch = async (_req: Request, res: Response) => {
	const log = createRequestLogger(Utility.getCurrentDate());
	const gmail = createGmailClient();
	const response = await gmail.users.watch({
		userId: "me",
		requestBody: {
			topicName: Config.getGmailPubsubTopic(),
			labelIds: ["INBOX"],
			labelFilterBehavior: "INCLUDE",
		},
	});

	const historyId = response.data.historyId;
	if (!historyId) {
		log.error("Watch response missing historyId");
		return res.status(500).send("Missing historyId");
	}

	const mailbox = Config.getGmailWatchUser();
	const sync = new GmailSyncStore();
	const stored = await sync.getHistoryId(mailbox);
	if (!stored) {
		await sync.saveHistoryId(mailbox, historyId);
		log.info({ historyId }, "Stored initial Gmail history cursor");
	}

	log.info({ expiration: response.data.expiration }, "Renewed Gmail watch");
	return res.status(204).send({});
};

functions.http("renewGmailWatch", renewGmailWatch);
