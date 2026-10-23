import type { Key } from "@google-cloud/datastore";
import { DateTime } from "luxon";
import { datastore } from "../datastore";
import type { IncomingAlert } from "../types/IncomingAlert.type";
import Utility from "../utility";

const MESSAGE_LOG_TTL_DAYS = 28;

export class MessageLogService {
	incomingKey(id: string): Key {
		return datastore.key(["IncomingRequest", id]);
	}

	async hasIncomingRequest(id: string): Promise<boolean> {
		const [entity] = await datastore.get(this.incomingKey(id));
		return Boolean(entity);
	}

	async logIncomingRequest(alert: IncomingAlert): Promise<Key> {
		const key = this.incomingKey(alert.id);
		await datastore.save({
			key,
			data: {
				messageId: alert.id,
				body: alert.body,
				from: alert.from,
				receivedAt: new Date().toISOString(),
				expiresAt: this.expiresAt(),
			},
		});
		return key;
	}

	async deleteIncomingRequest(id: string): Promise<void> {
		await datastore.delete(this.incomingKey(id));
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
