import type { Request, Response } from "@google-cloud/functions-framework";
import * as functions from "@google-cloud/functions-framework";
import { decodeGmailPush } from "../gmail/push";
import { handleGmailPush } from "../service/gmail-push.service";
import { createRequestLogger } from "../service/logging.service";
import Utility from "../utility";

export const receiveMessage = async (req: Request, res: Response) => {
	const currentDateTime = Utility.getCurrentDate();
	const log = createRequestLogger(currentDateTime);

	log.info("Received Gmail push notification");

	let notification: ReturnType<typeof decodeGmailPush>;
	try {
		notification = decodeGmailPush(req.body);
	} catch (error) {
		log.info({ err: error }, "Ignoring malformed Gmail push");
		return res.status(204).send({});
	}

	try {
		await handleGmailPush(notification, log);
	} catch (error) {
		log.error({ err: error }, "Failed to process Gmail push");
		return res.status(500).send("Failed to process Gmail push");
	}

	log.info("Completed function");
	return res.status(204).send({});
};

functions.http("receiveMessage", receiveMessage);
