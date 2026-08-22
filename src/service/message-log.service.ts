import type { Key } from "@google-cloud/datastore";
import { DateTime } from "luxon";
import { datastore } from "../datastore";
import type { TwilioBody } from "../types/RequestBody.type";
import Utility from "../utility";

const MESSAGE_LOG_TTL_DAYS = 28;

export class MessageLogService {
	logIncomingRequestKey(body: TwilioBody): Key {
		return datastore.key(["IncomingRequest", body.SmsMessageSid]);
	}

	async logIncomingRequest(body: TwilioBody): Promise<Key> {
		const key = this.logIncomingRequestKey(body);
		await datastore.save({
			key,
			data: {
				smsMessageSid: body.SmsMessageSid,
				body: body.Body,
				from: body.From,
				receivedAt: new Date().toISOString(),
				expiresAt: this.expiresAt(),
			},
		});
		return key;
	}

	async logOutgoingMessage(
		requestKey: Key,
		to: string,
		from: string,
		body: string,
	): Promise<void> {
		const key = datastore.key([...requestKey.path, "OutgoingMessage"]);
		await datastore.save({
			key,
			data: {
				to,
				from,
				body,
				sentAt: new Date().toISOString(),
				expiresAt: this.expiresAt(),
			},
		});
	}

	private expiresAt(): Date {
		return DateTime.fromISO(Utility.getCurrentDate())
			.plus({ days: MESSAGE_LOG_TTL_DAYS })
			.toJSDate();
	}
}
